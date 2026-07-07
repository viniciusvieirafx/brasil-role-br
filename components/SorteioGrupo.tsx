'use client'
import { useState } from 'react'

interface DiscordUser {
  id: string
  username: string
  avatar: string | null
  globalName: string | null
}

interface SorteioData {
  id: string
  titulo: string
  descricao: string
  expiraEm: string | null
  numVencedores: number
  tipoPremio: 'vip' | 'outro'
  descricaoPremio: string
  premioDias: number
  premioTier?: number
  totalParticipantes: number
  sorteado: boolean
  vencedores: { id: string; nome: string; colocacao: number }[]
  criadoEm: string
}

interface Props {
  grupo: { slug: string; nome: string }
  initialSorteio: SorteioData | null
  initialParticipando: boolean
  initialUser: DiscordUser | null
  initialVerified: boolean
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function formatDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dia = pad(d.getDate()), mes = pad(d.getMonth() + 1), ano = d.getFullYear()
  const hora = pad(d.getHours()), min = pad(d.getMinutes())
  const temHora = iso.includes('T') && !(hora === '00' && min === '00')
  return temHora ? `${dia}/${mes}/${ano} às ${hora}h${min}` : `${dia}/${mes}/${ano}`
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function SorteioGrupo({
  grupo, initialSorteio, initialParticipando, initialUser, initialVerified,
}: Props) {
  const [sorteio] = useState<SorteioData | null>(initialSorteio)
  const [participando, setParticipando] = useState(initialParticipando)
  const [total, setTotal] = useState(initialSorteio?.totalParticipantes ?? 0)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const handleParticipar = async () => {
    setErro('')
    setLoading(true)
    const res = await fetch(`/api/grupo/${grupo.slug}/participar`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setParticipando(true)
      setTotal(data.total)
    } else {
      if (res.status === 401) {
        window.location.href = `/api/auth/discord?from=sorteio-${grupo.slug}`
        return
      }
      if (res.status === 403) {
        window.location.href = `/?verificar=1#verificar`
        setLoading(false)
        return
      }
      setErro(data.error ?? 'Erro ao participar')
    }
    setLoading(false)
  }

  return (
    <section className="min-h-[70vh] py-24 bg-br-dark flex items-start justify-center">
      <div className="max-w-2xl w-full mx-auto px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/30 mb-8">
          <a href="/" className="hover:text-white/60 transition-colors">Brasil Role BR</a>
          <span>/</span>
          <span className="text-white/50">Sorteio — {grupo.nome}</span>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="text-br-yellow">SORTEIO</span>{' '}
            <span className="text-white">{grupo.nome.toUpperCase()}</span>
          </h2>
          <p className="text-gray-400 text-sm">Sorteio organizado em parceria com Brasil Role BR</p>
        </div>

        {!sorteio ? (
          <div className="bg-br-dark2 border border-white/10 rounded-2xl p-10 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold text-white/70 mb-2">Nenhum sorteio ativo no momento</h3>
            <p className="text-white/40 text-sm">Fique de olho no Discord do {grupo.nome}!</p>
          </div>
        ) : sorteio.sorteado ? (
          <div className="bg-br-dark2 border border-br-yellow/30 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/50 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
              Encerrado
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{sorteio.titulo}</h3>
            {sorteio.descricao && (
              <p className="text-white/50 text-sm mb-6 leading-relaxed whitespace-pre-wrap">{sorteio.descricao}</p>
            )}
            {sorteio.vencedores?.length > 0 && (
              <div className="bg-br-yellow/10 border border-br-yellow/30 rounded-xl p-6">
                <p className="text-white/50 text-sm mb-3">
                  {sorteio.vencedores.length === 1 ? 'Vencedor do sorteio' : `${sorteio.vencedores.length} ganhadores`}
                </p>
                <div className="flex flex-col gap-2">
                  {sorteio.vencedores.map((v, i) => (
                    <div key={v.id} className="flex items-center justify-center gap-2">
                      <span className="text-2xl">{MEDALS[i] ?? `${i + 1}º`}</span>
                      <span className="text-2xl font-bold text-br-yellow">{v.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-white/30 text-xs mt-4">{total} participantes · Obrigado a todos!</p>
          </div>
        ) : (
          <div className="bg-br-dark2 border border-white/10 rounded-2xl p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Ativo
                </div>
                <h3 className="text-lg font-bold text-white leading-snug">{sorteio.titulo}</h3>
                {sorteio.descricao && (
                  <p className="text-white/50 text-sm mt-2 leading-relaxed whitespace-pre-wrap">{sorteio.descricao}</p>
                )}
              </div>
              <div className="text-4xl">🎁</div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              {(sorteio.tipoPremio ?? 'vip') === 'vip' ? (
                <div className="flex items-center gap-2 bg-br-yellow/10 border border-br-yellow/30 rounded-full px-4 py-1.5 text-sm text-br-yellow font-semibold">
                  <span>👑</span>
                  {sorteio.premioDias} dias de {sorteio.premioTier === 3 ? 'VIP Ouro' : sorteio.premioTier === 2 ? 'VIP Prata' : 'VIP Bronze'}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-400/30 rounded-full px-4 py-1.5 text-sm text-purple-300 font-semibold">
                  <span>🎁</span>
                  {sorteio.descricaoPremio || 'Prêmio especial'}
                </div>
              )}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/60">
                <span>🏆</span>
                {sorteio.numVencedores} {sorteio.numVencedores === 1 ? 'ganhador' : 'ganhadores'}
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/60">
                <span>👥</span>
                {total} {total === 1 ? 'participante' : 'participantes'}
              </div>
              {sorteio.expiraEm && (() => {
                const dias = daysUntil(sorteio.expiraEm)
                return (
                  <div className={`flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm font-medium
                    ${dias > 3 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : dias > 0 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <span>📅</span>
                    {dias > 0 ? `Encerra em ${dias}d — ${formatDatetime(sorteio.expiraEm)}` : `Encerrou — ${formatDatetime(sorteio.expiraEm)}`}
                  </div>
                )
              })()}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-6 flex items-center gap-2 text-xs text-white/40">
              <span>✅</span>
              Obrigatório ter a conta VRChat verificada em brasil-role-br.com para participar
            </div>

            {!initialUser ? (
              <a
                href={`/api/auth/discord?from=sorteio-${grupo.slug}`}
                className="flex items-center justify-center gap-3 bg-[#5865F2] text-white font-bold px-6 py-4 rounded-xl hover:brightness-110 transition-all w-full text-lg"
              >
                <DiscordIcon />
                Login com Discord para participar
              </a>
            ) : !initialVerified ? (
              <a
                href="/?verificar=1#verificar"
                className="flex items-center justify-center gap-3 bg-br-yellow text-black font-bold px-6 py-4 rounded-xl hover:brightness-110 transition-all w-full text-lg"
              >
                Verificar VRChat para participar →
              </a>
            ) : participando ? (
              <div className="flex items-center justify-center gap-3 bg-green-500/15 border border-green-500/40 text-green-400 font-bold px-6 py-4 rounded-xl w-full text-lg">
                ✓ Você está participando! Boa sorte!
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleParticipar}
                  disabled={loading}
                  className="bg-br-yellow text-black font-bold px-6 py-4 rounded-xl hover:brightness-110 transition-all w-full text-lg disabled:opacity-50"
                >
                  {loading ? 'Entrando no sorteio...' : '🎲 Participar do Sorteio'}
                </button>
                {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-white/30 text-xs hover:text-white/50 transition-colors">
            ← Voltar para brasil-role-br.com
          </a>
        </div>
      </div>
    </section>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}
