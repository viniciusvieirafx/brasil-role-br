import { kvGet, kvSet, kvDel } from '@/lib/kv'
import { createHash } from 'crypto'

export type Grupo = {
  slug: string
  nome: string
  senhaHash: string
  canalId: string | null
  ativo: boolean
  vipsDisponiveis: number
}

export type GrupoSorteio = {
  id: string
  grupoSlug: string
  titulo: string
  descricao: string
  expiraEm: string | null
  numVencedores: number
  tipoPremio: 'vip' | 'outro'
  descricaoPremio: string
  premioDias: number
  participantes: string[]
  sorteado: boolean
  vencedores: { id: string; nome: string; colocacao: number }[]
  criadoEm: string
}

export function hashSenha(senha: string): string {
  return createHash('sha256').update(senha).digest('hex')
}

export async function getGrupo(slug: string): Promise<Grupo | null> {
  const raw = await kvGet(`grupo:${slug}`)
  return raw ? JSON.parse(raw) : null
}

export async function saveGrupo(grupo: Grupo): Promise<void> {
  await kvSet(`grupo:${grupo.slug}`, JSON.stringify(grupo))
}

export async function listGrupos(): Promise<Grupo[]> {
  const listaRaw = await kvGet('grupos:lista')
  if (!listaRaw) return []
  const slugs: string[] = JSON.parse(listaRaw)
  const results = await Promise.all(slugs.map(s => getGrupo(s)))
  return results.filter(Boolean) as Grupo[]
}

export async function addGrupoToList(slug: string): Promise<void> {
  const listaRaw = await kvGet('grupos:lista')
  const lista: string[] = listaRaw ? JSON.parse(listaRaw) : []
  if (!lista.includes(slug)) {
    lista.push(slug)
    await kvSet('grupos:lista', JSON.stringify(lista))
  }
}

export async function removeGrupoFromList(slug: string): Promise<void> {
  const listaRaw = await kvGet('grupos:lista')
  if (!listaRaw) return
  const lista: string[] = JSON.parse(listaRaw)
  await kvSet('grupos:lista', JSON.stringify(lista.filter(s => s !== slug)))
}

export async function getGrupoSorteioAtivo(slug: string): Promise<GrupoSorteio | null> {
  const aId = await kvGet(`grupo:${slug}:sorteio:ativo`)
  if (!aId) return null
  const raw = await kvGet(`grupo:${slug}:sorteio:${aId}`)
  return raw ? JSON.parse(raw) : null
}

export async function saveGrupoSorteio(sorteio: GrupoSorteio): Promise<void> {
  await kvSet(`grupo:${sorteio.grupoSlug}:sorteio:${sorteio.id}`, JSON.stringify(sorteio))
}

export async function setGrupoSorteioAtivo(slug: string, id: string): Promise<void> {
  await kvSet(`grupo:${slug}:sorteio:ativo`, id)
}

export async function clearGrupoSorteioAtivo(slug: string): Promise<void> {
  await kvDel(`grupo:${slug}:sorteio:ativo`)
}
