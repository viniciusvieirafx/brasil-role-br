'use client'
import { useEffect, useState, useCallback } from 'react'

type VipsPorTier = { 1: number; 2: number; 3: number }

type Grupo = {
  slug: string
  nome: string
  canalId: string | null
  vipsDisponiveis: number
  vipsPorTier: VipsPorTier
}

type GrupoSorteio = {
  id: string
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

function formatDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function ControleGrupoPage() {
  const [autenticado, setAutenticado] = useState(false)
  const [nomeGrupo, setNomeGrupo] = useState('')
  const [slugLogado, setSlugLogado] = useState('')
  const [loading, setLoading] = useState(true)

  // Login
  const [grupos, setGrupos] = useState<{ slug: string; nome: string }[]>([])
  const [slugSelecionado, setSlugSelecionado] = useState('')
  const [senha, setSenha] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const [loadingLogin, setLoadingLogin] = useState(false)

  // Dados do grupo
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [sorteio, setSorteio] = useState<GrupoSorteio | null>(null)
  const [canalId, setCanalId] = useState('')
  const [salvandoCanal, setSalvandoCanal] = useState(false)
  const [msgCanal, setMsgCanal] = useState('')

  // Criar sorteio
  const [criando, setCriando] = useState(false)
  const [formDescricao, setFormDescricao] = useState('')
  const [formNumVencedores, setFormNumVencedores] = useState('1')
  const [formExpiraEm, setFormExpiraEm] = useState('')
  const [formPremioDias, setFormPremioDias] = useState('30')
  const [formTipoPremio, setFormTipoPremio] = useState<'vip' | 'outro'>('vip')
  const [formDescricaoPremio, setFormDescricaoPremio] = useState('')
  const [erroSorteio, setErroSorteio] = useState('')
  const [loadingCriar, setLoadingCriar] = useState(false)

  const [formPremioTier, setFormPremioTier] = useState(1)

  // Sortear
  const [loadingSortear, setLoadingSortear] = useState(false)
  const [erroSortear, setErroSortear] = useState('')

  // Presentear VIP
  const [giftName, setGiftName] = useState('')
  const [giftTier, setGiftTier] = useState(1)
  const [giftLoading, setGiftLoading] = useState(false)
  const [giftMsg, setGiftMsg] = useState<{ type: 'success' | 'pending' | 'error'; text: string } | null>(null)

  // Invite URL
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  // Verificar sessão
  useEffect(() => {
    fetch('/api/controle/grupo/auth').then(r => r.json()).then(d => {
      if (d.authenticated) {
        setAutenticado(true)
        setNomeGrupo(d.nome ?? '')
        setSlugLogado(d.slug ?? '')
      }
      setLoading(false)
    })
  }, [])

  // Carregar lista de grupos para o select de login
  useEffect(() => {
    fetch('/api/grupos/lista').then(r => r.json()).then(d => {
      if (d.grupos) setGrupos(d.grupos)
    }).catch(() => {})
  }, [])

  const carregarDados = useCallback(async () => {
    const r = await fetch('/api/controle/grupo/sorteio')
    if (!r.ok) return
    const d = await r.json()
    setGrupo(d.grupo)
    setSorteio(d.sorteio)
    if (d.grupo?.canalId) setCanalId(d.grupo.canalId)
  }, [])

  useEffect(() => {
    if (autenticado) {
      carregarDados()
      fetch('/api/controle/grupo/invite')
        .then(r => r.json())
        .then(d => { if (d.url) setInviteUrl(d.url) })
        .catch(() => {})
    }
  }, [autenticado, carregarDados])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroLogin('')
    setLoadingLogin(true)
    const res = await fetch('/api/controle/grupo/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slugSelecionado, senha }),
    })
    const data = await res.json()
    if (res.ok) {
      setAutenticado(true)
      setNomeGrupo(data.nome)
      setSlugLogado(data.slug)
    } else {
      setErroLogin(data.error ?? 'Erro ao fazer login')
    }
    setLoadingLogin(false)
  }

  const handleLogout = async () => {
    await fetch('/api/controle/grupo/auth', { method: 'DELETE' })
    setAutenticado(false)
    setNomeGrupo('')
    setSlugLogado('')
    setGrupo(null)
    setSorteio(null)
  }

  const handleSalvarCanal = async () => {
    setSalvandoCanal(true)
    setMsgCanal('')
    const res = await fetch('/api/controle/grupo/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canalId: canalId.trim() }),
    })
    setSalvandoCanal(false)
    setMsgCanal(res.ok ? 'Canal salvo!' : 'Erro ao salvar')
    setTimeout(() => setMsgCanal(''), 3000)
  }

  const handleCriarSorteio = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroSorteio('')
    setLoadingCriar(true)
    const res = await fetch('/api/controle/grupo/sorteio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descricao: formDescricao,
        numVencedores: parseInt(formNumVencedores) || 1,
        expiraEm: formExpiraEm || null,
        premioDias: 30,
        tipoPremio: formTipoPremio,
        descricaoPremio: formDescricaoPremio,
        premioTier: formPremioTier,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setCriando(false)
      setFormDescricao('')
      setFormNumVencedores('1')
      setFormExpiraEm('')
      setFormPremioDias('30')
      setFormTipoPremio('vip')
      setFormDescricaoPremio('')
      await carregarDados()
    } else {
      setErroSorteio(data.error ?? 'Erro ao criar sorteio')
    }
    setLoadingCriar(false)
  }

  const handleSortear = async () => {
    if (!confirm('Executar o sorteio agora?')) return
    setLoadingSortear(true)
    setErroSortear('')
    const res = await fetch('/api/controle/grupo/sorteio/sortear', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      await carregarDados()
    } else {
      setErroSortear(data.error ?? 'Erro ao sortear')
    }
    setLoadingSortear(false)
  }

  const handleEncerrar = async () => {
    if (!confirm('Encerrar e deletar o sorteio ativo?')) return
    await fetch('/api/controle/grupo/sorteio', { method: 'DELETE' })
    await carregarDados()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-br-dark flex items-center justify-center">
        <div className="text-white/40 text-sm">Carregando...</div>
      </div>
    )
  }

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-br-dark flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Painel do Grupo</h1>
            <p className="text-white/40 text-sm">brasil-role-br.com</p>
          </div>
          <form onSubmit={handleLogin} className="bg-br-dark2 border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-white/60 text-xs mb-1.5 uppercase tracking-wider">Grupo</label>
              <select
                value={slugSelecionado}
                onChange={e => setSlugSelecionado(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-br-yellow/40"
                required
              >
                <option value="">Selecione seu grupo...</option>
                {grupos.map(g => (
                  <option key={g.slug} value={g.slug}>{g.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5 uppercase tracking-wider">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-br-yellow/40"
                placeholder="••••••••••"
                required
              />
            </div>
            {erroLogin && <p className="text-red-400 text-sm">{erroLogin}</p>}
            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full bg-br-yellow text-black font-bold py-2.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 text-sm"
            >
              {loadingLogin ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <p className="text-center mt-4">
            <a href="/" className="text-white/30 text-xs hover:text-white/50 transition-colors">← Voltar ao site</a>
          </p>
        </div>
      </div>
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://brasil-role-br.com'

  return (
    <div className="min-h-screen bg-br-dark text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-br-dark2/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <span className="font-bold text-white">{nomeGrupo}</span>
            <span className="text-white/30 text-xs ml-2">Painel do Grupo</span>
          </div>
          <button onClick={handleLogout} className="text-white/40 text-xs hover:text-white/60 transition-colors">
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* VIPs disponíveis por tier */}
        <div className="bg-br-dark2 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs uppercase tracking-wider">VIPs Disponíveis</p>
            <div className="text-4xl">🎁</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/20 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${(grupo?.vipsPorTier?.[1] ?? 0) > 0 ? 'text-amber-600' : 'text-white/20'}`}>
                {grupo?.vipsPorTier?.[1] ?? 0}
              </p>
              <p className="text-white/40 text-xs mt-0.5">Bronze</p>
            </div>
            <div className="bg-black/20 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${(grupo?.vipsPorTier?.[2] ?? 0) > 0 ? 'text-gray-300' : 'text-white/20'}`}>
                {grupo?.vipsPorTier?.[2] ?? 0}
              </p>
              <p className="text-white/40 text-xs mt-0.5">Prata</p>
            </div>
            <div className="bg-black/20 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${(grupo?.vipsPorTier?.[3] ?? 0) > 0 ? 'text-yellow-400' : 'text-white/20'}`}>
                {grupo?.vipsPorTier?.[3] ?? 0}
              </p>
              <p className="text-white/40 text-xs mt-0.5">Ouro</p>
            </div>
          </div>
          {(grupo?.vipsDisponiveis ?? 0) === 0 && (
            <p className="text-white/30 text-xs mt-3">
              Entre em contato com a administração do Brasil Role BR para receber mais VIPs.
            </p>
          )}
        </div>

        {/* Presentear VIP */}
        {(grupo?.vipsDisponiveis ?? 0) > 0 && (
          <div className="bg-br-dark2 border border-white/10 rounded-2xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Presentear VIP</p>
            <div className="space-y-3">
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Nome no VRChat</label>
                <input
                  type="text"
                  value={giftName}
                  onChange={e => setGiftName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-br-yellow/40"
                  placeholder="Ex: NomeDoUsuario"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Tier do VIP</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { t: 1, label: 'Bronze', color: 'amber-600', estoque: grupo?.vipsPorTier?.[1] ?? 0 },
                    { t: 2, label: 'Prata', color: 'gray-300', estoque: grupo?.vipsPorTier?.[2] ?? 0 },
                    { t: 3, label: 'Ouro', color: 'yellow-400', estoque: grupo?.vipsPorTier?.[3] ?? 0 },
                  ] as const).map(({ t, label, estoque }) => (
                    <button
                      key={t}
                      type="button"
                      disabled={estoque <= 0}
                      onClick={() => setGiftTier(t)}
                      className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                        giftTier === t && estoque > 0
                          ? 'bg-br-yellow/20 border-br-yellow text-br-yellow'
                          : estoque > 0
                          ? 'bg-black/20 border-white/10 text-white/40 hover:text-white/60'
                          : 'bg-black/10 border-white/5 text-white/15 cursor-not-allowed'
                      }`}
                    >
                      {label} ({estoque})
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!giftName.trim()) return
                  setGiftLoading(true)
                  setGiftMsg(null)
                  const res = await fetch('/api/controle/grupo/gift', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vrchatName: giftName.trim(), tier: giftTier }),
                  })
                  const data = await res.json()
                  if (res.ok) {
                    setGiftMsg({ type: data.status === 'activated' ? 'success' : 'pending', text: data.message })
                    setGiftName('')
                    await carregarDados()
                  } else {
                    setGiftMsg({ type: 'error', text: data.error ?? 'Erro ao presentear' })
                  }
                  setGiftLoading(false)
                }}
                disabled={giftLoading || !giftName.trim()}
                className="w-full bg-br-yellow text-black font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm disabled:opacity-50"
              >
                {giftLoading ? 'Enviando...' : '🎁 Dar VIP'}
              </button>
              {giftMsg && (
                <div className={`text-xs px-3 py-2 rounded-lg border ${
                  giftMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : giftMsg.type === 'pending' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {giftMsg.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Link do sorteio */}
        <div className="bg-br-dark2 border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Link do Sorteio</p>
          <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
            <span className="text-white/60 text-sm flex-1 truncate">
              {`${siteUrl}/sorteio/${slugLogado}`}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(`${siteUrl}/sorteio/${slugLogado}`)}
              className="text-br-yellow text-xs hover:brightness-110 shrink-0"
            >
              Copiar
            </button>
          </div>
          <p className="text-white/30 text-xs mt-2">
            O bot posta este link automaticamente quando você criar um sorteio.
          </p>
        </div>

        {/* Canal Discord */}
        <div className="bg-br-dark2 border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Canal de Anúncios (Discord)</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={canalId}
              onChange={e => setCanalId(e.target.value)}
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-br-yellow/40"
              placeholder="ID do canal (ex: 1234567890123456789)"
            />
            <button
              onClick={handleSalvarCanal}
              disabled={salvandoCanal}
              className="bg-br-yellow text-black font-bold px-4 py-2 rounded-lg hover:brightness-110 transition-all text-sm disabled:opacity-50"
            >
              {salvandoCanal ? '...' : 'Salvar'}
            </button>
          </div>
          {msgCanal && (
            <p className={`text-xs mt-2 ${msgCanal.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>
              {msgCanal}
            </p>
          )}

          {/* Tutorial ID do canal */}
          <details className="mt-3 group">
            <summary className="text-white/40 text-xs cursor-pointer hover:text-white/60 transition-colors select-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Como pegar o ID do canal?
            </summary>
            <div className="mt-3 space-y-2.5 text-xs text-white/50 leading-relaxed bg-black/20 rounded-xl p-4 border border-white/5">
              <p className="font-semibold text-white/70">Passo a passo:</p>
              <div className="flex gap-2">
                <span className="text-br-yellow font-bold shrink-0">1.</span>
                <span>Abra o Discord no <strong className="text-white/70">computador</strong> (desktop ou browser).</span>
              </div>
              <div className="flex gap-2">
                <span className="text-br-yellow font-bold shrink-0">2.</span>
                <span>Vá em <strong className="text-white/70">Configurações do usuário</strong> (ícone de engrenagem perto do seu nome) → <strong className="text-white/70">Aparência</strong>.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-br-yellow font-bold shrink-0">3.</span>
                <span>Role até o final e ative o <strong className="text-white/70">Modo de Desenvolvedor</strong>.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-br-yellow font-bold shrink-0">4.</span>
                <span>Volte para o seu servidor, <strong className="text-white/70">clique com o botão direito</strong> no canal onde quer que o bot poste os anúncios.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-br-yellow font-bold shrink-0">5.</span>
                <span>Clique em <strong className="text-white/70">&quot;Copiar ID do canal&quot;</strong> — vai aparecer no final do menu.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-br-yellow font-bold shrink-0">6.</span>
                <span>Cole o número aqui em cima e clique em <strong className="text-white/70">Salvar</strong>.</span>
              </div>
              <p className="text-white/30 pt-1 border-t border-white/5">
                ⚠️ O bot precisa estar no servidor e ter permissão de <strong className="text-white/50">Enviar Mensagens</strong> nesse canal.
              </p>
            </div>
          </details>
        </div>

        {/* Sorteio ativo */}
        <div className="bg-br-dark2 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/40 text-xs uppercase tracking-wider">Sorteio Ativo</p>
            {!sorteio && !criando && (
              <button
                onClick={() => setCriando(true)}
                className="bg-br-yellow text-black font-bold px-4 py-1.5 rounded-lg hover:brightness-110 transition-all text-xs"
              >
                + Criar Sorteio
              </button>
            )}
          </div>

          {criando ? (
            <form onSubmit={handleCriarSorteio} className="space-y-4">
              {/* Tipo de prêmio */}
              <div>
                <label className="block text-white/60 text-xs mb-2">Tipo de Prêmio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTipoPremio('vip')}
                    className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                      formTipoPremio === 'vip'
                        ? 'bg-br-yellow/20 border-br-yellow text-br-yellow'
                        : 'bg-black/20 border-white/10 text-white/40 hover:text-white/60'
                    }`}
                  >
                    👑 VIP
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipoPremio('outro')}
                    className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                      formTipoPremio === 'outro'
                        ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                        : 'bg-black/20 border-white/10 text-white/40 hover:text-white/60'
                    }`}
                  >
                    🎁 Outro prêmio
                  </button>
                </div>
              </div>

              {formTipoPremio === 'vip' && (grupo?.vipsDisponiveis ?? 0) === 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs">
                  Sem VIPs disponíveis. Escolha &quot;Outro prêmio&quot; ou peça VIPs à administração.
                </div>
              )}

              {formTipoPremio === 'vip' && (grupo?.vipsDisponiveis ?? 0) > 0 && (
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Tier do VIP</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { t: 1, label: 'Bronze', estoque: grupo?.vipsPorTier?.[1] ?? 0 },
                      { t: 2, label: 'Prata', estoque: grupo?.vipsPorTier?.[2] ?? 0 },
                      { t: 3, label: 'Ouro', estoque: grupo?.vipsPorTier?.[3] ?? 0 },
                    ] as const).map(({ t, label, estoque }) => (
                      <button
                        key={t}
                        type="button"
                        disabled={estoque <= 0}
                        onClick={() => setFormPremioTier(t)}
                        className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                          formPremioTier === t && estoque > 0
                            ? 'bg-br-yellow/20 border-br-yellow text-br-yellow'
                            : estoque > 0
                            ? 'bg-black/20 border-white/10 text-white/40 hover:text-white/60'
                            : 'bg-black/10 border-white/5 text-white/15 cursor-not-allowed'
                        }`}
                      >
                        {label} ({estoque})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formTipoPremio === 'outro' && (
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Descrição do Prêmio</label>
                  <input
                    type="text"
                    value={formDescricaoPremio}
                    onChange={e => setFormDescricaoPremio(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400/40"
                    placeholder="Ex: Key do jogo X, Skin exclusiva, R$50 em créditos..."
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Aviso / Descrição</label>
                <textarea
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-br-yellow/40 resize-none"
                  placeholder="Descreva o sorteio — isso será enviado no Discord..."
                  required
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Nº de Ganhadores</label>
                <input
                  type="number" min="1"
                  max={formTipoPremio === 'vip' ? (grupo?.vipsPorTier?.[formPremioTier as 1 | 2 | 3] ?? 1) : 99}
                  value={formNumVencedores}
                  onChange={e => setFormNumVencedores(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-br-yellow/40"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Data e Hora de Encerramento</label>
                <input
                  type="datetime-local"
                  value={formExpiraEm}
                  onChange={e => setFormExpiraEm(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-br-yellow/40"
                />
              </div>
              {erroSorteio && <p className="text-red-400 text-sm">{erroSorteio}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loadingCriar || (formTipoPremio === 'vip' && (grupo?.vipsDisponiveis ?? 0) === 0)}
                  className="flex-1 bg-br-yellow text-black font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm disabled:opacity-50"
                >
                  {loadingCriar ? 'Criando...' : '🎲 Criar e Anunciar no Discord'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCriando(false); setErroSorteio(''); setFormTipoPremio('vip'); setFormDescricaoPremio('') }}
                  className="px-4 py-2.5 border border-white/10 rounded-lg text-white/50 hover:text-white/70 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : !sorteio ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🎲</div>
              <p className="text-white/40 text-sm">Nenhum sorteio ativo. Crie um novo!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {sorteio.sorteado ? (
                    <span className="inline-flex items-center gap-2 bg-white/10 text-white/50 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-2">
                      Encerrado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold px-3 py-1 rounded-full mb-2 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                      Ativo
                    </span>
                  )}
                  <h3 className="text-white font-semibold">{sorteio.titulo}</h3>
                  {sorteio.descricao && (
                    <p className="text-white/50 text-sm mt-1 whitespace-pre-wrap">{sorteio.descricao}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{sorteio.participantes.length}</p>
                  <p className="text-white/40 text-xs mt-0.5">participantes</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-br-yellow">{sorteio.numVencedores}</p>
                  <p className="text-white/40 text-xs mt-0.5">ganhadores</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 text-center">
                  {(sorteio.tipoPremio ?? 'vip') === 'vip' ? (
                    <>
                      <p className="text-2xl font-bold text-white">{sorteio.premioDias}d</p>
                      <p className="text-white/40 text-xs mt-0.5">VIP</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-purple-300 leading-tight truncate">🎁</p>
                      <p className="text-white/40 text-xs mt-0.5 truncate" title={sorteio.descricaoPremio}>
                        {sorteio.descricaoPremio || 'Prêmio especial'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {sorteio.expiraEm && !sorteio.sorteado && (
                <div className={`text-xs px-3 py-2 rounded-lg border ${
                  daysUntil(sorteio.expiraEm) > 2
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                }`}>
                  📅 Encerra em {formatDatetime(sorteio.expiraEm)}
                  {sorteio.expiraEm && ` · ${daysUntil(sorteio.expiraEm)} dias restantes`}
                </div>
              )}

              {/* Vencedores */}
              {sorteio.sorteado && sorteio.vencedores.length > 0 && (
                <div className="bg-br-yellow/10 border border-br-yellow/30 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Vencedores</p>
                  <div className="space-y-1.5">
                    {sorteio.vencedores.map((v, i) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <span className="text-lg">{['🥇','🥈','🥉'][i] ?? `${i+1}º`}</span>
                        <span className="text-white font-semibold text-sm">{v.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              {!sorteio.sorteado && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSortear}
                    disabled={loadingSortear || sorteio.participantes.length === 0}
                    className="flex-1 bg-br-yellow text-black font-bold py-2.5 rounded-lg hover:brightness-110 transition-all text-sm disabled:opacity-50"
                  >
                    {loadingSortear ? 'Sorteando...' : '🎲 Executar Sorteio'}
                  </button>
                  <button
                    onClick={handleEncerrar}
                    className="px-4 py-2.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors"
                  >
                    Encerrar
                  </button>
                </div>
              )}
              {erroSortear && <p className="text-red-400 text-sm">{erroSortear}</p>}

              {sorteio.participantes.length === 0 && !sorteio.sorteado && (
                <p className="text-white/30 text-xs text-center">
                  Nenhum participante ainda. O sorteio será encerrado automaticamente sem ganhador se não houver inscritos.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bot invite */}
        <div className="bg-br-dark2 border border-white/5 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Convidar o Bot</p>
          <p className="text-white/40 text-xs leading-relaxed mb-3">
            Para o bot postar anúncios no seu servidor, clique no botão abaixo e adicione o bot. Depois configure o ID do canal acima.
          </p>
          {inviteUrl ? (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#5865F2] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:brightness-110 transition-all"
            >
              <DiscordIcon />
              Adicionar Bot ao Servidor
            </a>
          ) : (
            <p className="text-white/20 text-xs">Link de convite não configurado. Fale com a administração do Brasil Role BR.</p>
          )}
        </div>

      </div>
    </div>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}
