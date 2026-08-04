import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/kv'
import { executarSorteio, anunciarVencedores, concederVip, notificarVencedores, anunciarVencedoresGrupo } from '@/lib/sorteio'
import { listGrupos, getGrupoSorteioAtivo, saveGrupoSorteio, saveGrupo } from '@/lib/grupos'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const aId = await kvGet('sorteio:ativo')
  if (!aId) return NextResponse.json({ ok: true, msg: 'Nenhum sorteio ativo' })

  const raw = await kvGet(`sorteio:${aId}`)
  if (!raw) return NextResponse.json({ ok: true, msg: 'Sorteio não encontrado' })

  const sorteio = JSON.parse(raw)

  if (sorteio.sorteado) return NextResponse.json({ ok: true, msg: 'Já sorteado' })

  if (!sorteio.expiraEm) return NextResponse.json({ ok: true, msg: 'Sem data de encerramento automática' })

  const now = new Date()
  // Usa fim do dia UTC (23:59:59) para não encerrar antes da hora
  const expira = new Date(sorteio.expiraEm + 'T23:59:59Z')
  if (now < expira) return NextResponse.json({ ok: true, msg: 'Sorteio ainda não encerrou' })

  // Mark as drawn even if no participants to prevent repeated checks
  if (sorteio.participantes.length === 0) {
    sorteio.sorteado = true
    await kvSet(`sorteio:${aId}`, JSON.stringify(sorteio))
    console.log(`[cron/sorteio] Sorteio ${aId} encerrado automaticamente sem participantes`)
    return NextResponse.json({ ok: true, msg: 'Encerrado sem participantes' })
  }

  const vencedores = await executarSorteio(sorteio)

  sorteio.sorteado = true
  sorteio.vencedores = vencedores
  await kvSet(`sorteio:${aId}`, JSON.stringify(sorteio))

  const modoResultado: 'igual' | 'colocacao' = sorteio.modoResultado ?? 'igual'
  const premio: string | null = sorteio.premio ?? null
  const premioDias: number = sorteio.premioDias ?? 30

  if (premio === 'vip') {
    await Promise.all(vencedores.map(v => concederVip(v.id, premioDias)))
  }

  try {
    await notificarVencedores(vencedores, premio, premioDias)
  } catch (e) {
    console.error('[cron/sorteio] Falha ao notificar vencedores por DM:', e)
  }

  try {
    await anunciarVencedores(
      sorteio.titulo,
      sorteio.descricao,
      vencedores,
      sorteio.participantes.length,
      sorteio.vipBonus,
      sorteio.vipMultiplier,
      modoResultado,
      premio,
      premioDias,
    )
  } catch (e) {
    console.error('[cron/sorteio] Falha ao anunciar no Discord:', e)
  }

  console.log(`[cron/sorteio] Sorteio ${aId} executado automaticamente. Vencedores: ${vencedores.map(v => v.id).join(', ')}`)

  // ── Processar sorteios de grupos parceiros ──────────────────────────────────
  const gruposResults: { slug: string; status: string }[] = []

  try {
    const grupos = await listGrupos()
    const now2 = new Date()

    for (const grupo of grupos) {
      if (!grupo.ativo) continue
      const sorteioGrupo = await getGrupoSorteioAtivo(grupo.slug)
      if (!sorteioGrupo || sorteioGrupo.sorteado) continue
      if (!sorteioGrupo.expiraEm) continue

      const expira2 = new Date(sorteioGrupo.expiraEm + 'T23:59:59Z')
      if (now2 < expira2) continue

      if (sorteioGrupo.participantes.length === 0) {
        sorteioGrupo.sorteado = true
        await saveGrupoSorteio(sorteioGrupo)
        gruposResults.push({ slug: grupo.slug, status: 'encerrado_sem_participantes' })
        continue
      }

      const vencedoresG = await executarSorteio({
        participantes: sorteioGrupo.participantes,
        numVencedores: sorteioGrupo.numVencedores,
        vipBonus: false,
      })

      sorteioGrupo.sorteado = true
      sorteioGrupo.vencedores = vencedoresG
      await saveGrupoSorteio(sorteioGrupo)

      await Promise.all(vencedoresG.map(v => concederVip(v.id, sorteioGrupo.premioDias)))

      grupo.vipsDisponiveis = Math.max(0, grupo.vipsDisponiveis - vencedoresG.length)
      await saveGrupo(grupo)

      try { await notificarVencedores(vencedoresG, 'vip', sorteioGrupo.premioDias) } catch {}
      try { await anunciarVencedoresGrupo(grupo, sorteioGrupo, vencedoresG) } catch {}

      gruposResults.push({ slug: grupo.slug, status: 'sorteado', vencedores: vencedoresG.map(v => v.id).join(', ') } as { slug: string; status: string })
    }
  } catch (e) {
    console.error('[cron/sorteio] Erro ao processar sorteios de grupos:', e)
  }

  return NextResponse.json({ ok: true, vencedores, grupos: gruposResults })
}
