'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'

type VipEntry = {
  discordId:    string
  username:     string | null
  globalName:   string | null
  nick:         string | null
  expiresAt:    string
  diasRestantes: number
  ativo:        boolean
  tier?:        1 | 2 | 3
  vitalicio?:   boolean
  assinante?:   boolean
}

const TIER_INFO: Record<number, { icon: string; label: string; color: string; bg: string }> = {
  1: { icon: '🥉', label: 'Bronze', color: 'text-amber-500', bg: 'bg-amber-900/30' },
  2: { icon: '🥈', label: 'Prata',  color: 'text-slate-300', bg: 'bg-slate-700/40' },
  3: { icon: '🥇', label: 'Ouro',   color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
}

type Propaganda = {
  id: string
  comprador: string
  compradoEm: string
  expiraEm: string
  contatoVia: 'discord' | 'instagram' | 'tiktok'
  imagemThumb: string | null
  notificado: boolean
}

type VerificadoEntry = {
  discordId:  string
  username:   string | null
  globalName: string | null
  nick:       string | null
  avatar:     string | null
  joinedAt:   string | null
}

type Tab = 'vips' | 'verificados' | 'propagandas' | 'sorteios' | 'grupos'

type GrupoAdmin = {
  slug: string
  nome: string
  canalId: string | null
  ativo: boolean
  vipsDisponiveis: number
  vipsPorTier: { 1: number; 2: number; 3: number }
  senhaHash: string
}

type SorteioAdmin = {
  id: string
  titulo: string
  descricao: string
  expiraEm: string | null
  vipBonus: boolean
  vipMultiplier: number
  numVencedores: number
  modoResultado: 'igual' | 'colocacao'
  premio: 'vip' | null
  premioDias: number
  participantes: string[]
  participantesInfo: { id: string; isVip: boolean }[]
  criadoEm: string
  sorteado: boolean
  vencedores: { id: string; nome: string; colocacao: number }[]
}

function displayName(v: VipEntry): string {
  return v.nick ?? v.globalName ?? v.username ?? v.discordId
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function diasRestantesProp(expiraEm: string): number {
  const exp  = new Date(expiraEm)
  const hoje = new Date()
  exp.setHours(0, 0, 0, 0)
  hoje.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - hoje.getTime()) / 86400000)
}

function DaysBadge({ dias }: { dias: number }) {
  let cls = 'px-2 py-0.5 rounded text-xs font-bold '
  if (dias > 14)      cls += 'bg-green-900/60 text-green-300'
  else if (dias > 6)  cls += 'bg-yellow-900/60 text-yellow-300'
  else if (dias > 0)  cls += 'bg-orange-900/60 text-orange-300'
  else                cls += 'bg-red-900/60 text-red-400'
  const label = dias > 0 ? `${dias}d` : dias === 0 ? 'hoje' : `${Math.abs(dias)}d atrás`
  return <span className={cls}>{label}</span>
}

const CONTATO_LABEL: Record<string, string> = {
  discord:   '🎮 Discord',
  instagram: '📷 Instagram',
  tiktok:    '🎵 TikTok',
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const maxW  = 72
        const scale = Math.min(1, maxW / img.width)
        const w     = Math.round(img.width * scale)
        const h     = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width  = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.25))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ControlePage() {
  const [status, setStatus]     = useState<'loading' | 'login' | 'dashboard'>('loading')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('vips')

  // ── VIPs ──────────────────────────────────────────────────
  const [vips, setVips]         = useState<VipEntry[]>([])
  const [fetching, setFetching] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate]   = useState('')
  const [newId, setNewId]         = useState('')
  const [newDays, setNewDays]     = useState(30)
  const [addErr, setAddErr]       = useState('')
  const [busy, setBusy]           = useState<string | null>(null)
  const [importJson, setImportJson]   = useState('')
  const [importOpen, setImportOpen]   = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [vrcEditId, setVrcEditId]     = useState<string | null>(null)
  const [vrcInput, setVrcInput]       = useState('')
  const [vrcErr, setVrcErr]           = useState<string | null>(null)
  const [newTier, setNewTier]         = useState<1|2|3>(1)
  const [newVitalicio, setNewVitalicio] = useState(false)

  // ── Verificados ────────────────────────────────────────────
  const [verificados, setVerificados]       = useState<VerificadoEntry[]>([])
  const [verFetching, setVerFetching]       = useState(false)
  const [verSearch, setVerSearch]           = useState('')
  const [verVrcEditId, setVerVrcEditId]     = useState<string | null>(null)
  const [verVrcInput, setVerVrcInput]       = useState('')
  const [verVrcErr, setVerVrcErr]           = useState<string | null>(null)
  const [verBusy, setVerBusy]              = useState<string | null>(null)

  // ── Sorteios ──────────────────────────────────────────────
  const [sorteio, setSorteio]             = useState<SorteioAdmin | null>(null)
  const [sorteioFetch, setSorteioFetch]   = useState(false)
  const [sTitulo, setSTitulo]             = useState('')
  const [sDescricao, setSDescricao]       = useState('')
  const [sExpiraEm, setSExpiraEm]         = useState('')
  const [sVipBonus, setSVipBonus]         = useState(false)
  const [sVipMult, setSVipMult]           = useState(3)
  const [sErr, setSErr]                   = useState('')
  const [sCreateBusy, setSCreateBusy]     = useState(false)
  const [sSortBusy, setSortBusy]          = useState(false)
  const [sDelBusy, setSDelBusy]           = useState(false)
  const [sEditOpen, setSEditOpen]         = useState(false)
  const [sEditTitulo, setSEditTitulo]     = useState('')
  const [sEditDesc, setSEditDesc]         = useState('')
  const [sEditExpira, setSEditExpira]     = useState('')
  const [sEditVipBonus, setSEditVipBonus] = useState(false)
  const [sEditVipMult, setSEditVipMult]   = useState(3)
  const [sEditBusy, setSEditBusy]         = useState(false)
  const [sEditErr, setSEditErr]           = useState('')
  const [sNumVencedores, setSNumVencedores]           = useState(1)
  const [sModoResultado, setSModoResultado]           = useState<'igual' | 'colocacao'>('igual')
  const [sEditNumVencedores, setSEditNumVencedores]   = useState(1)
  const [sEditModoResultado, setSEditModoResultado]   = useState<'igual' | 'colocacao'>('igual')
  const [sPremio, setSPremio]                         = useState<'vip' | null>(null)
  const [sPremioDias, setSPremioDias]                 = useState(30)
  const [sEditPremio, setSEditPremio]                 = useState<'vip' | null>(null)
  const [sEditPremioDias, setSEditPremioDias]         = useState(30)

  // ── Grupos ───────────────────────────────────────────────
  const [grupos, setGrupos]                 = useState<GrupoAdmin[]>([])
  const [gruposFetch, setGruposFetch]       = useState(false)
  const [gNome, setGNome]                   = useState('')
  const [gSlug, setGSlug]                   = useState('')
  const [gSenha, setGSenha]                 = useState('')
  const [gErr, setGErr]                     = useState('')
  const [gBusy, setGBusy]                   = useState(false)
  const [gVipsSlug, setGVipsSlug]           = useState<string | null>(null)
  const [gVipsQtd, setGVipsQtd]             = useState(1)
  const [gVipsTier, setGVipsTier]           = useState(1)
  const [gVipsBusy, setGVipsBusy]           = useState(false)

  // ── Propagandas ───────────────────────────────────────────
  const [propagandas, setPropagandas]       = useState<Propaganda[]>([])
  const [propFetching, setPropFetching]     = useState(false)
  const [propComprador, setPropComprador]   = useState('')
  const [propCompradoEm, setPropCompradoEm] = useState(todayStr())
  const [propExpiraEm, setPropExpiraEm]     = useState('')
  const [propContatoVia, setPropContatoVia] = useState<Propaganda['contatoVia']>('discord')
  const [propImagem, setPropImagem]         = useState<string | null>(null)
  const [propErr, setPropErr]               = useState('')
  const [propBusy, setPropBusy]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadVips = useCallback(async () => {
    setFetching(true)
    const res = await fetch('/api/controle/vips')
    if (res.ok) setVips(await res.json())
    setFetching(false)
  }, [])

  const loadSorteio = useCallback(async () => {
    setSorteioFetch(true)
    const res = await fetch('/api/controle/sorteio')
    if (res.ok) {
      const d = await res.json()
      setSorteio(d.sorteio)
    }
    setSorteioFetch(false)
  }, [])

  const loadPropagandas = useCallback(async () => {
    setPropFetching(true)
    const res = await fetch('/api/controle/propagandas')
    if (res.ok) setPropagandas(await res.json())
    setPropFetching(false)
  }, [])

  const loadGrupos = useCallback(async () => {
    setGruposFetch(true)
    const res = await fetch('/api/controle/grupos')
    if (res.ok) setGrupos(await res.json())
    setGruposFetch(false)
  }, [])

  const loadVerificados = useCallback(async () => {
    setVerFetching(true)
    const res = await fetch('/api/controle/verificados')
    if (res.ok) setVerificados(await res.json())
    setVerFetching(false)
  }, [])

  useEffect(() => {
    fetch('/api/controle/auth')
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) { setStatus('dashboard'); loadVips(); loadPropagandas(); loadSorteio(); loadGrupos(); loadVerificados() }
        else setStatus('login')
      })
      .catch(() => setStatus('login'))
  }, [loadVips, loadPropagandas, loadSorteio, loadVerificados])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr('')
    const res = await fetch('/api/controle/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })
    if (res.ok) { setStatus('dashboard'); loadVips(); loadPropagandas(); loadSorteio(); loadGrupos(); loadVerificados() }
    else {
      const d = await res.json()
      setLoginErr(d.error ?? 'Erro')
      setPassword('')
    }
  }

  async function handleLogout() {
    await fetch('/api/controle/auth', { method: 'DELETE' })
    setStatus('login')
    setVips([])
    setPropagandas([])
    setSorteio(null)
    setPassword('')
  }

  async function handleCreateSorteio(e: React.FormEvent) {
    e.preventDefault()
    setSErr('')
    if (!sTitulo.trim()) { setSErr('Informe o título'); return }
    setSCreateBusy(true)
    const res = await fetch('/api/controle/sorteio', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        titulo:         sTitulo,
        descricao:      sDescricao,
        expiraEm:       sExpiraEm || null,
        vipBonus:       sVipBonus,
        vipMultiplier:  sVipMult,
        numVencedores:  sNumVencedores,
        modoResultado:  sModoResultado,
        premio:         sPremio,
        premioDias:     sPremioDias,
      }),
    })
    if (res.ok) {
      setSTitulo(''); setSDescricao(''); setSExpiraEm(''); setSVipBonus(false); setSVipMult(3)
      setSNumVencedores(1); setSModoResultado('igual'); setSPremio(null); setSPremioDias(30)
      await loadSorteio()
    } else {
      const d = await res.json()
      setSErr(d.error ?? 'Erro ao criar sorteio')
    }
    setSCreateBusy(false)
  }

  async function handleSortear() {
    if (!confirm('Sortear o vencedor agora? Esta ação não pode ser desfeita.')) return
    setSortBusy(true)
    const res = await fetch('/api/controle/sorteio/sortear', { method: 'POST' })
    const d = await res.json()
    if (!res.ok) { alert(d.error ?? 'Erro ao sortear') }
    await loadSorteio()
    setSortBusy(false)
  }

  async function handleDeleteSorteio() {
    if (!confirm('Encerrar e apagar o sorteio atual? Os dados serão perdidos.')) return
    setSDelBusy(true)
    await fetch('/api/controle/sorteio', { method: 'DELETE' })
    setSorteio(null)
    setSDelBusy(false)
  }

  function openEditSorteio() {
    if (!sorteio) return
    setSEditTitulo(sorteio.titulo)
    setSEditDesc(sorteio.descricao)
    setSEditExpira(sorteio.expiraEm ?? '')
    setSEditVipBonus(sorteio.vipBonus)
    setSEditVipMult(sorteio.vipMultiplier)
    setSEditNumVencedores(sorteio.numVencedores ?? 1)
    setSEditModoResultado(sorteio.modoResultado ?? 'igual')
    setSEditPremio(sorteio.premio ?? null)
    setSEditPremioDias(sorteio.premioDias ?? 30)
    setSEditErr('')
    setSEditOpen(true)
  }

  async function handleEditSorteio(e: React.FormEvent) {
    e.preventDefault()
    setSEditErr('')
    if (!sEditTitulo.trim()) { setSEditErr('Título obrigatório'); return }
    setSEditBusy(true)
    const res = await fetch('/api/controle/sorteio', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo:         sEditTitulo,
        descricao:      sEditDesc,
        expiraEm:       sEditExpira || null,
        vipBonus:       sEditVipBonus,
        vipMultiplier:  sEditVipMult,
        numVencedores:  sEditNumVencedores,
        modoResultado:  sEditModoResultado,
        premio:         sEditPremio,
        premioDias:     sEditPremioDias,
      }),
    })
    if (res.ok) {
      setSEditOpen(false)
      await loadSorteio()
    } else {
      const d = await res.json()
      setSEditErr(d.error ?? 'Erro ao salvar')
    }
    setSEditBusy(false)
  }

  async function addDays(discordId: string, days: number) {
    setBusy(`add-${discordId}`)
    await fetch(`/api/controle/vips/${discordId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ addDays: days }),
    })
    await loadVips()
    setBusy(null)
  }

  async function saveEditDate(discordId: string) {
    if (!editDate) return
    setBusy(`edit-${discordId}`)
    await fetch(`/api/controle/vips/${discordId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ expiresAt: editDate }),
    })
    setEditingId(null)
    await loadVips()
    setBusy(null)
  }

  async function handleUpdateVrcNick(discordId: string) {
    const username = vrcInput.trim()
    if (!username) return
    setVrcErr(null)
    setBusy(`vrc-${discordId}`)
    const res = await fetch(`/api/controle/vips/${discordId}/update-nick`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ vrchatUsername: username }),
    })
    const data = await res.json()
    if (res.ok) {
      setVips(prev => prev.map(v =>
        v.discordId === discordId ? { ...v, nick: data.displayName } : v
      ))
      setVrcEditId(null)
      setVrcInput('')
    } else {
      setVrcErr(data.error ?? 'Erro ao atualizar')
    }
    setBusy(null)
  }

  async function notifyVip(discordId: string, name: string) {
    setBusy(`notify-${discordId}`)
    const res = await fetch(`/api/controle/vips/${discordId}/notify`, { method: 'POST' })
    if (!res.ok) alert(`Erro ao enviar DM para ${name}`)
    setBusy(null)
  }

  async function removeVip(discordId: string, name: string) {
    if (!confirm(`Remover VIP de ${name}?`)) return
    setBusy(`del-${discordId}`)
    await fetch(`/api/controle/vips/${discordId}`, { method: 'DELETE' })
    await loadVips()
    setBusy(null)
  }

  async function handleAddVip(e: React.FormEvent) {
    e.preventDefault()
    setAddErr('')
    const id = newId.trim()
    if (!id || !/^\d{17,19}$/.test(id)) {
      setAddErr('ID inválido — deve ter 17–19 dígitos')
      return
    }
    setBusy('add-new')
    const res = await fetch(`/api/controle/vips/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        expiresAt: newVitalicio ? '9999-12-31' : daysFromNow(newDays),
        tier:      newTier,
        vitalicio: newVitalicio,
      }),
    })
    if (res.ok) {
      setNewId('')
      setNewDays(30)
      setNewTier(1)
      setNewVitalicio(false)
      await loadVips()
    } else {
      setAddErr('Erro ao adicionar')
    }
    setBusy(null)
  }

  async function handleImport() {
    setImportResult(null)
    let data: unknown[]
    try { data = JSON.parse(importJson) } catch { setImportResult('JSON inválido'); return }
    setBusy('import')
    const res = await fetch('/api/controle/import', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })
    const result = await res.json()
    if (res.ok) {
      setImportResult(`${result.total} VIPs importados com sucesso`)
      setImportJson('')
      setImportOpen(false)
      await loadVips()
    } else {
      setImportResult(result.error ?? 'Erro na importação')
    }
    setBusy(null)
  }

  async function handleVerUpdateNick(discordId: string) {
    const username = verVrcInput.trim()
    if (!username) return
    setVerVrcErr(null)
    setVerBusy(`vrc-${discordId}`)
    const res = await fetch(`/api/controle/verificados/${discordId}/update-nick`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ vrchatUsername: username }),
    })
    const data = await res.json()
    if (res.ok) {
      setVerificados(prev => prev.map(v =>
        v.discordId === discordId ? { ...v, nick: data.displayName } : v
      ))
      setVerVrcEditId(null)
      setVerVrcInput('')
    } else {
      setVerVrcErr(data.error ?? 'Erro ao atualizar')
    }
    setVerBusy(null)
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const thumb = await compressImage(file)
      setPropImagem(thumb)
    } catch {
      setPropErr('Erro ao processar imagem')
    }
  }

  async function handleAddPropaganda(e: React.FormEvent) {
    e.preventDefault()
    setPropErr('')
    if (!propComprador.trim()) { setPropErr('Informe o comprador'); return }
    if (!propExpiraEm)         { setPropErr('Informe a data de expiração'); return }
    setPropBusy(true)
    const res = await fetch('/api/controle/propagandas', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        comprador:    propComprador,
        compradoEm:   propCompradoEm,
        expiraEm:     propExpiraEm,
        contatoVia:   propContatoVia,
        imagemThumb:  propImagem,
      }),
    })
    if (res.ok) {
      setPropComprador('')
      setPropCompradoEm(todayStr())
      setPropExpiraEm('')
      setPropContatoVia('discord')
      setPropImagem(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadPropagandas()
    } else {
      const d = await res.json()
      setPropErr(d.error ?? 'Erro ao salvar')
    }
    setPropBusy(false)
  }

  async function handleDeletePropaganda(id: string, comprador: string) {
    if (!confirm(`Remover propaganda de ${comprador}?`)) return
    await fetch(`/api/controle/propagandas/${id}`, { method: 'DELETE' })
    await loadPropagandas()
  }

  // ── Loading ──────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-br-dark flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-br-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Login ────────────────────────────────────────────────
  if (status === 'login') {
    return (
      <div className="min-h-screen bg-br-dark flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-br-dark2 border border-white/10 rounded-xl p-8 flex flex-col gap-5"
        >
          <h1 className="text-xl font-bold text-br-yellow text-center tracking-wide">
            Controle
          </h1>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            className="bg-br-dark border border-white/15 rounded-lg px-4 py-2.5 text-white placeholder-white/30
                       focus:outline-none focus:border-br-yellow/60 transition-colors"
          />
          {loginErr && <p className="text-red-400 text-sm text-center">{loginErr}</p>}
          <button
            type="submit"
            className="bg-br-yellow text-black font-bold py-2.5 rounded-lg hover:brightness-110 transition-all"
          >
            Entrar
          </button>
        </form>
      </div>
    )
  }

  // ── Dashboard ────────────────────────────────────────────
  const vitalicioCount  = vips.filter(v => v.vitalicio).length
  const assinanteCount  = vips.filter(v => v.assinante).length
  const pagantes        = vips.filter(v => !v.vitalicio)
  const ativos          = pagantes.filter(v => v.diasRestantes > 0).length
  const vencendo        = pagantes.filter(v => v.diasRestantes > 0 && v.diasRestantes <= 7).length
  const vencidos        = pagantes.filter(v => v.diasRestantes <= 0).length

  return (
    <div className="min-h-screen bg-br-dark text-white p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-br-yellow tracking-wide">Controle</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Sair
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-br-dark2 border border-white/10 rounded-xl p-1 w-fit">
        {([['vips', 'VIPs'], ['verificados', 'Verificados'], ['propagandas', 'Propagandas'], ['sorteios', 'Sorteios'], ['grupos', 'Grupos']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-br-yellow text-black'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Aba VIPs ──────────────────────────────────────── */}
      {activeTab === 'vips' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-3 mb-8">
            {[
              { label: 'Ativos',      value: ativos,          color: 'text-green-400' },
              { label: 'Vencendo',    value: vencendo,        color: 'text-yellow-400' },
              { label: 'Vencidos',    value: vencidos,        color: 'text-red-400' },
              { label: 'Vitalícios',  value: vitalicioCount,  color: 'text-purple-400' },
              { label: 'Assinantes',  value: assinanteCount,  color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-br-dark2 border border-white/10 rounded-xl p-4 text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Adicionar VIP */}
          <form
            onSubmit={handleAddVip}
            className="bg-br-dark2 border border-white/10 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end"
          >
            {/* ID */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">ID do Discord</label>
              <input
                type="text"
                placeholder="385405521215094787"
                value={newId}
                onChange={e => setNewId(e.target.value)}
                className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                           placeholder-white/20 focus:outline-none focus:border-br-yellow/50 w-52"
              />
            </div>

            {/* Tier */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">Tier</label>
              <div className="flex gap-1">
                {([1, 2, 3] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewTier(t)}
                    className={`text-sm px-3 py-2 rounded-lg font-medium transition-colors
                      ${newTier === t
                        ? 'bg-br-yellow text-black'
                        : 'bg-br-dark border border-white/15 text-white/60 hover:border-white/30'
                      }`}
                  >
                    {TIER_INFO[t].icon} {TIER_INFO[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duração — escondida se vitalício */}
            {!newVitalicio && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Duração</label>
                <div className="flex gap-1">
                  {[10, 30, 45, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewDays(d)}
                      className={`text-sm px-3 py-2 rounded-lg font-medium transition-colors
                        ${newDays === d
                          ? 'bg-br-yellow text-black'
                          : 'bg-br-dark border border-white/15 text-white/60 hover:border-white/30'
                        }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Toggle vitalício */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">Vitalício</label>
              <button
                type="button"
                onClick={() => setNewVitalicio(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${newVitalicio
                    ? 'bg-purple-700/50 border-purple-500/60 text-purple-200'
                    : 'bg-br-dark border-white/15 text-white/50 hover:border-white/30'
                  }`}
              >
                <span>♾️</span>
                <span>Sem validade</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={busy === 'add-new'}
              className="bg-br-yellow text-black text-sm font-bold px-4 py-2 rounded-lg
                         hover:brightness-110 transition-all disabled:opacity-50"
            >
              {busy === 'add-new' ? '...' : '+ Adicionar VIP'}
            </button>
            {addErr && <p className="text-red-400 text-sm w-full">{addErr}</p>}
          </form>

          {/* Importar JSON */}
          <div className="bg-br-dark2 border border-white/10 rounded-xl mb-6 overflow-hidden">
            <button
              onClick={() => setImportOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/60 hover:text-white/90 transition-colors"
            >
              <span>Importar backup JSON</span>
              <span>{importOpen ? '▲' : '▼'}</span>
            </button>
            {importOpen && (
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/10 pt-3">
                <p className="text-xs text-white/40">Cole o conteúdo do arquivo JSON. Formato esperado: array com campos <code className="text-white/60">id</code> e <code className="text-white/60">vence</code>.</p>
                <textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  rows={6}
                  placeholder='[{"id":"385405521215094787","vence":"2026-06-14","nick":"xayxayx"}, ...]'
                  className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-xs text-white font-mono
                             placeholder-white/20 focus:outline-none focus:border-br-yellow/50 resize-y"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleImport}
                    disabled={!importJson.trim() || busy === 'import'}
                    className="bg-br-yellow text-black text-sm font-bold px-4 py-2 rounded-lg
                               hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {busy === 'import' ? 'Importando...' : 'Importar'}
                  </button>
                  {importResult && (
                    <p className={`text-sm ${importResult.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>
                      {importResult}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tabela VIPs */}
          <div className="bg-br-dark2 border border-white/10 rounded-xl overflow-hidden">
            {fetching ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-br-yellow border-t-transparent rounded-full animate-spin" />
              </div>
            ) : vips.length === 0 ? (
              <p className="text-center text-white/30 py-12">Nenhum VIP encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-xs uppercase">
                      <th className="text-left px-4 py-3">Nome</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">ID Discord</th>
                      <th className="text-left px-4 py-3">Tier</th>
                      <th className="text-left px-4 py-3">Vencimento</th>
                      <th className="text-left px-4 py-3">Dias</th>
                      <th className="text-right px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vips.map((v, i) => (
                      <React.Fragment key={v.discordId}>
                      <tr
                        className={`border-b border-white/5 ${vrcEditId === v.discordId ? 'border-purple-900/40' : 'last:border-0'} ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                      >
                        {/* Nome + badges */}
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{displayName(v)}</span>
                            {v.vitalicio && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-800/50 text-purple-300 leading-none">♾️ vitalício</span>
                            )}
                            {v.assinante && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-800/50 text-blue-300 leading-none">💳 assinante</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/40 font-mono text-xs hidden md:table-cell">
                          {v.discordId}
                        </td>
                        {/* Tier */}
                        <td className="px-4 py-3">
                          {v.tier ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${TIER_INFO[v.tier].bg} ${TIER_INFO[v.tier].color}`}>
                              {TIER_INFO[v.tier].icon} {TIER_INFO[v.tier].label}
                            </span>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </td>
                        {/* Vencimento */}
                        <td className="px-4 py-3">
                          {v.vitalicio ? (
                            <span className="text-purple-400 text-sm font-bold">♾️ sem limite</span>
                          ) : editingId === v.discordId ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={editDate}
                                onChange={e => setEditDate(e.target.value)}
                                className="bg-br-dark border border-white/20 rounded px-2 py-1 text-xs text-white
                                           focus:outline-none focus:border-br-yellow/50"
                              />
                              <button
                                onClick={() => saveEditDate(v.discordId)}
                                disabled={busy === `edit-${v.discordId}`}
                                className="text-green-400 hover:text-green-300 text-xs font-bold"
                              >
                                {busy === `edit-${v.discordId}` ? '...' : 'Salvar'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-white/30 hover:text-white/60 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className={v.diasRestantes <= 0 ? 'text-red-400/70 line-through' : ''}>
                              {formatDate(v.expiresAt)}
                            </span>
                          )}
                        </td>
                        {/* Dias */}
                        <td className="px-4 py-3">
                          {v.vitalicio
                            ? <span className="text-xs text-purple-400 font-bold">∞</span>
                            : <DaysBadge dias={v.diasRestantes} />
                          }
                        </td>
                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {/* Botões +dias: só para pagantes */}
                            {!v.vitalicio && (
                              busy === `add-${v.discordId}` ? (
                                <span className="text-xs text-white/40">...</span>
                              ) : (
                                <div className="flex gap-1">
                                  {[1, 10, 30].map(d => (
                                    <button
                                      key={d}
                                      onClick={() => addDays(v.discordId, d)}
                                      disabled={!!busy}
                                      title={`+${d} dias`}
                                      className="text-xs bg-green-900/40 text-green-300 hover:bg-green-900/70
                                                 px-1.5 py-1 rounded transition-colors disabled:opacity-40"
                                    >
                                      +{d}
                                    </button>
                                  ))}
                                </div>
                              )
                            )}
                            <button
                              onClick={() => {
                                setVrcEditId(v.discordId)
                                setVrcInput('')
                                setVrcErr(null)
                              }}
                              disabled={!!busy}
                              title="Atualizar nick do VRChat no Discord"
                              className="text-xs bg-purple-900/30 text-purple-400 hover:bg-purple-900/60
                                         px-2 py-1 rounded transition-colors disabled:opacity-40"
                            >
                              VRC
                            </button>
                            <button
                              onClick={() => notifyVip(v.discordId, displayName(v))}
                              disabled={!!busy}
                              title="Enviar DM sobre VIP"
                              className="text-xs bg-blue-900/30 text-blue-400 hover:bg-blue-900/60
                                         px-2 py-1 rounded transition-colors disabled:opacity-40"
                            >
                              {busy === `notify-${v.discordId}` ? '...' : 'DM'}
                            </button>
                            {/* Alterar data: só para pagantes */}
                            {!v.vitalicio && (
                              <button
                                onClick={() => {
                                  setEditingId(v.discordId)
                                  setEditDate(v.expiresAt)
                                }}
                                disabled={!!busy}
                                title="Alterar data"
                                className="text-xs bg-white/10 text-white/60 hover:bg-white/20
                                           px-2 py-1 rounded transition-colors disabled:opacity-40"
                              >
                                Data
                              </button>
                            )}
                            <button
                              onClick={() => removeVip(v.discordId, displayName(v))}
                              disabled={!!busy}
                              title="Remover VIP"
                              className="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60
                                         px-2 py-1 rounded transition-colors disabled:opacity-40"
                            >
                              {busy === `del-${v.discordId}` ? '...' : 'Remover'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {vrcEditId === v.discordId && (
                        <tr className="bg-purple-950/20 border-b border-white/5">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-purple-300 font-semibold">Username VRChat:</span>
                              <input
                                type="text"
                                autoFocus
                                placeholder="ex: NomeExatoNoVRChat"
                                value={vrcInput}
                                onChange={e => { setVrcInput(e.target.value); setVrcErr(null) }}
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdateVrcNick(v.discordId) }}
                                className="bg-br-dark border border-purple-700/50 rounded px-2 py-1 text-xs text-white
                                           placeholder-white/20 focus:outline-none focus:border-purple-500 w-48"
                              />
                              <button
                                onClick={() => handleUpdateVrcNick(v.discordId)}
                                disabled={busy === `vrc-${v.discordId}` || !vrcInput.trim()}
                                className="text-xs bg-purple-700 text-white font-bold px-3 py-1 rounded
                                           hover:bg-purple-600 transition-colors disabled:opacity-50"
                              >
                                {busy === `vrc-${v.discordId}` ? 'Buscando...' : 'Atualizar nick'}
                              </button>
                              <button
                                onClick={() => { setVrcEditId(null); setVrcInput(''); setVrcErr(null) }}
                                className="text-xs text-white/30 hover:text-white/60"
                              >
                                ✕
                              </button>
                              {vrcErr && <span className="text-xs text-red-400">{vrcErr}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Aba Verificados ─────────────────────────────── */}
      {activeTab === 'verificados' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-br-dark2 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{verificados.length}</p>
              <p className="text-xs text-white/40 mt-1">Total verificados</p>
            </div>
            <div className="bg-br-dark2 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{verificados.filter(v => v.nick).length}</p>
              <p className="text-xs text-white/40 mt-1">Com nick personalizado</p>
            </div>
          </div>

          {/* Busca */}
          <div className="bg-br-dark2 border border-white/10 rounded-xl p-4 mb-6">
            <input
              type="text"
              placeholder="Buscar por nome, nick ou ID..."
              value={verSearch}
              onChange={e => setVerSearch(e.target.value)}
              className="w-full bg-br-dark border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white
                         placeholder-white/30 focus:outline-none focus:border-br-yellow/60 transition-colors"
            />
          </div>

          {/* Tabela */}
          <div className="bg-br-dark2 border border-white/10 rounded-xl overflow-hidden">
            {verFetching ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-br-yellow border-t-transparent rounded-full animate-spin" />
              </div>
            ) : verificados.length === 0 ? (
              <p className="text-center text-white/30 py-12">Nenhum verificado encontrado</p>
            ) : (() => {
              const term = verSearch.toLowerCase().trim()
              const filtered = term
                ? verificados.filter(v =>
                    (v.nick ?? '').toLowerCase().includes(term) ||
                    (v.globalName ?? '').toLowerCase().includes(term) ||
                    (v.username ?? '').toLowerCase().includes(term) ||
                    v.discordId.includes(term)
                  )
                : verificados
              return filtered.length === 0 ? (
                <p className="text-center text-white/30 py-12">Nenhum resultado para &quot;{verSearch}&quot;</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 text-xs uppercase">
                        <th className="text-left px-4 py-3">Nome</th>
                        <th className="text-left px-4 py-3 hidden md:table-cell">Username</th>
                        <th className="text-left px-4 py-3 hidden md:table-cell">ID Discord</th>
                        <th className="text-right px-4 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((v, i) => (
                        <React.Fragment key={v.discordId}>
                          <tr className={`border-b border-white/5 ${verVrcEditId === v.discordId ? 'border-purple-900/40' : 'last:border-0'} ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{v.nick ?? v.globalName ?? v.username ?? v.discordId}</span>
                                {v.nick && v.globalName && v.nick !== v.globalName && (
                                  <span className="text-xs text-white/30">({v.globalName})</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-white/40 text-xs hidden md:table-cell">
                              {v.username ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-white/40 font-mono text-xs hidden md:table-cell">
                              {v.discordId}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setVerVrcEditId(v.discordId)
                                    setVerVrcInput('')
                                    setVerVrcErr(null)
                                  }}
                                  disabled={!!verBusy}
                                  title="Atualizar nick via VRChat"
                                  className="text-xs bg-purple-900/30 text-purple-400 hover:bg-purple-900/60
                                             px-2 py-1 rounded transition-colors disabled:opacity-40"
                                >
                                  VRC
                                </button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(v.discordId)
                                  }}
                                  title="Copiar ID"
                                  className="text-xs bg-white/10 text-white/60 hover:bg-white/20
                                             px-2 py-1 rounded transition-colors"
                                >
                                  ID
                                </button>
                              </div>
                            </td>
                          </tr>
                          {verVrcEditId === v.discordId && (
                            <tr className="bg-purple-950/20 border-b border-white/5">
                              <td colSpan={4} className="px-4 py-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-purple-300 font-semibold">Username VRChat:</span>
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="ex: NomeExatoNoVRChat"
                                    value={verVrcInput}
                                    onChange={e => { setVerVrcInput(e.target.value); setVerVrcErr(null) }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleVerUpdateNick(v.discordId) }}
                                    className="bg-br-dark border border-purple-700/50 rounded px-2 py-1 text-xs text-white
                                               placeholder-white/20 focus:outline-none focus:border-purple-500 w-48"
                                  />
                                  <button
                                    onClick={() => handleVerUpdateNick(v.discordId)}
                                    disabled={verBusy === `vrc-${v.discordId}` || !verVrcInput.trim()}
                                    className="text-xs bg-purple-700 text-white font-bold px-3 py-1 rounded
                                               hover:bg-purple-600 transition-colors disabled:opacity-50"
                                  >
                                    {verBusy === `vrc-${v.discordId}` ? 'Buscando...' : 'Atualizar nick'}
                                  </button>
                                  <button
                                    onClick={() => { setVerVrcEditId(null); setVerVrcInput(''); setVerVrcErr(null) }}
                                    className="text-xs text-white/30 hover:text-white/60"
                                  >
                                    ✕
                                  </button>
                                  {verVrcErr && <span className="text-xs text-red-400">{verVrcErr}</span>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>

          {/* Botão atualizar */}
          <button
            onClick={loadVerificados}
            disabled={verFetching}
            className="mt-4 text-sm text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
          >
            {verFetching ? 'Atualizando...' : 'Atualizar lista'}
          </button>
        </>
      )}

      {/* ─── Aba Sorteios ─────────────────────────────────── */}
      {activeTab === 'sorteios' && (
        <>
          {sorteioFetch ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-br-yellow border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sorteio ? (
            /* ── Sorteio ativo ── */
            <div className="flex flex-col gap-6">
              {/* Card de status */}
              <div className="bg-br-dark2 border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-2 uppercase tracking-widest
                      ${sorteio.sorteado
                        ? 'bg-white/10 text-white/40'
                        : 'bg-green-500/20 border border-green-500/40 text-green-400'}`}>
                      {sorteio.sorteado
                        ? 'Encerrado'
                        : <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /> Ativo</>}
                    </div>
                    <h3 className="text-xl font-bold text-white">{sorteio.titulo}</h3>
                    {sorteio.descricao && <p className="text-white/50 text-sm mt-1">{sorteio.descricao}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!sorteio.sorteado && (
                      <button
                        onClick={openEditSorteio}
                        className="text-xs bg-white/10 text-white/60 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      onClick={handleDeleteSorteio}
                      disabled={sDelBusy}
                      className="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {sDelBusy ? '...' : 'Encerrar'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="bg-white/5 border border-white/10 rounded-full px-3 py-1 text-white/50">
                    👥 {sorteio.participantes.length} participantes
                  </span>
                  {sorteio.vipBonus && (
                    <span className="bg-br-yellow/10 border border-br-yellow/30 rounded-full px-3 py-1 text-br-yellow text-xs font-semibold">
                      👑 VIP Bônus ativo ({sorteio.vipMultiplier}x)
                    </span>
                  )}
                  {sorteio.premio === 'vip' && (
                    <span className="bg-purple-500/10 border border-purple-500/30 rounded-full px-3 py-1 text-purple-300 text-xs font-semibold">
                      🎁 Prêmio: {sorteio.premioDias ?? 30}d de VIP (auto)
                    </span>
                  )}
                  {sorteio.expiraEm && (
                    <span className="bg-white/5 border border-white/10 rounded-full px-3 py-1 text-white/50">
                      📅 Encerra: {(() => {
                        const d = new Date(sorteio.expiraEm)
                        const pad = (n: number) => String(n).padStart(2, '0')
                        const temHora = sorteio.expiraEm.includes('T') && !(pad(d.getHours()) === '00' && pad(d.getMinutes()) === '00')
                        return temHora
                          ? `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} às ${pad(d.getHours())}h${pad(d.getMinutes())}`
                          : `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`
                      })()}
                    </span>
                  )}
                </div>
              </div>

              {/* Editar sorteio */}
              {sEditOpen && !sorteio.sorteado && (
                <form onSubmit={handleEditSorteio} className="bg-br-dark border border-br-yellow/20 rounded-xl p-5 flex flex-col gap-4">
                  <p className="text-sm font-semibold text-br-yellow uppercase tracking-wider">Editar sorteio</p>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">Título *</label>
                    <input
                      type="text"
                      value={sEditTitulo}
                      onChange={e => setSEditTitulo(e.target.value)}
                      className="bg-br-dark2 border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                                 focus:outline-none focus:border-br-yellow/50"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">Descrição</label>
                    <textarea
                      value={sEditDesc}
                      onChange={e => setSEditDesc(e.target.value)}
                      rows={5}
                      className="bg-br-dark2 border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                                 focus:outline-none focus:border-br-yellow/50 resize-y min-h-[120px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/40">Data e hora de encerramento</label>
                      <input
                        type="datetime-local"
                        value={sEditExpira}
                        onChange={e => setSEditExpira(e.target.value)}
                        className="bg-br-dark2 border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                                   focus:outline-none focus:border-br-yellow/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/40">Multiplicador VIP</label>
                      <div className="flex gap-1">
                        {[2, 3, 5].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSEditVipMult(n)}
                            className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors
                              ${sEditVipMult === n
                                ? 'bg-br-yellow text-black'
                                : 'bg-br-dark2 border border-white/15 text-white/60 hover:border-white/30'
                              }`}
                          >
                            {n}×
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/40">Número de ganhadores</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={sEditNumVencedores}
                        onChange={e => setSEditNumVencedores(Math.max(1, parseInt(e.target.value) || 1))}
                        className="bg-br-dark2 border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                                   focus:outline-none focus:border-br-yellow/50"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/40">Modo de resultado</label>
                      <div className="flex gap-1">
                        {(['igual', 'colocacao'] as const).map(modo => (
                          <button
                            key={modo}
                            type="button"
                            onClick={() => setSEditModoResultado(modo)}
                            className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors
                              ${sEditModoResultado === modo
                                ? 'bg-br-yellow text-black'
                                : 'bg-br-dark2 border border-white/15 text-white/60 hover:border-white/30'
                              }`}
                          >
                            {modo === 'igual' ? '🤝 Iguais' : '🥇 Com colocação'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs text-white/40">Prêmio automático ao encerrar</label>
                      <div className="flex gap-1">
                        {([null, 'vip'] as const).map(p => (
                          <button
                            key={String(p)}
                            type="button"
                            onClick={() => setSEditPremio(p)}
                            className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors
                              ${sEditPremio === p
                                ? 'bg-br-yellow text-black'
                                : 'bg-br-dark2 border border-white/15 text-white/60 hover:border-white/30'
                              }`}
                          >
                            {p === null ? '🎁 Nenhum' : '👑 VIP'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {sEditPremio === 'vip' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/40">Dias de VIP para os vencedores</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={sEditPremioDias}
                          onChange={e => setSEditPremioDias(Math.max(1, parseInt(e.target.value) || 30))}
                          className="bg-br-dark2 border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                                     focus:outline-none focus:border-br-yellow/50"
                        />
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div
                      onClick={() => setSEditVipBonus(v => !v)}
                      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                        ${sEditVipBonus ? 'bg-br-yellow' : 'bg-white/20'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all
                        ${sEditVipBonus ? 'left-6' : 'left-1'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Bônus para VIPs</p>
                      <p className="text-xs text-white/40">VIPs terão {sEditVipMult}x mais chances</p>
                    </div>
                  </label>

                  {sEditErr && <p className="text-red-400 text-sm">{sEditErr}</p>}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={sEditBusy}
                      className="bg-br-yellow text-black text-sm font-bold px-5 py-2 rounded-lg
                                 hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {sEditBusy ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSEditOpen(false)}
                      className="text-sm text-white/40 hover:text-white/70 px-4 py-2 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Vencedores */}
              {sorteio.sorteado && sorteio.vencedores?.length > 0 && (
                <div className="bg-br-yellow/10 border border-br-yellow/30 rounded-xl p-5">
                  <p className="text-white/50 text-sm mb-3 text-center">
                    {sorteio.vencedores.length === 1 ? '🏆 Vencedor sorteado' : `🏆 ${sorteio.vencedores.length} ganhadores sorteados`}
                  </p>
                  <div className="flex flex-col gap-2">
                    {sorteio.vencedores.map(v => (
                      <div key={v.id} className="flex items-center justify-between bg-br-yellow/10 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-2">
                          {sorteio.modoResultado === 'colocacao' && (
                            <span className="text-lg">{['🥇','🥈','🥉'][v.colocacao - 1] ?? `${v.colocacao}º`}</span>
                          )}
                          <span className="text-br-yellow font-bold">{v.nome}</span>
                        </div>
                        <span className="text-white/30 text-xs font-mono">{v.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão sortear */}
              {!sorteio.sorteado && (
                <button
                  onClick={handleSortear}
                  disabled={sSortBusy || sorteio.participantes.length === 0}
                  className="bg-br-yellow text-black font-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 w-full"
                >
                  {sSortBusy ? 'Sorteando...' : `🎲 Sortear ${(sorteio.numVencedores ?? 1) > 1 ? `${sorteio.numVencedores} Vencedores` : 'Vencedor'} (${sorteio.participantes.length} participantes)`}
                </button>
              )}

              {/* Lista de participantes */}
              {sorteio.participantesInfo.length > 0 && (
                <div className="bg-br-dark2 border border-white/10 rounded-xl overflow-hidden">
                  <p className="text-xs text-white/40 uppercase tracking-widest px-4 py-3 border-b border-white/5">
                    Participantes
                  </p>
                  <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                    {sorteio.participantesInfo.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-white/20 text-xs w-5">{i + 1}</span>
                          <span className="font-mono text-white/60 text-xs">{p.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.isVip && (
                            <span className="text-xs bg-br-yellow/20 text-br-yellow px-2 py-0.5 rounded font-bold">
                              VIP {sorteio.vipBonus ? `×${sorteio.vipMultiplier}` : ''}
                            </span>
                          )}
                          {sorteio.vencedores?.find(v => v.id === p.id) && (() => {
                            const v = sorteio.vencedores.find(v => v.id === p.id)!
                            const label = sorteio.modoResultado === 'colocacao'
                              ? `${['🥇','🥈','🥉'][v.colocacao - 1] ?? `${v.colocacao}º`} ${v.colocacao}º lugar`
                              : '🏆 Ganhador'
                            return (
                              <span className="text-xs bg-green-900/60 text-green-300 px-2 py-0.5 rounded font-bold">
                                {label}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Criar sorteio ── */
            <form onSubmit={handleCreateSorteio} className="bg-br-dark2 border border-white/10 rounded-xl p-5 flex flex-col gap-4">
              <p className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                Criar novo sorteio
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Título */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs text-white/40">Título do sorteio *</label>
                  <input
                    type="text"
                    placeholder="Ex: Sorteio de VIP 30 dias!"
                    value={sTitulo}
                    onChange={e => setSTitulo(e.target.value)}
                    className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                               placeholder-white/20 focus:outline-none focus:border-br-yellow/50"
                  />
                </div>

                {/* Descrição */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs text-white/40">Descrição (opcional)</label>
                  <textarea
                    placeholder="Descreva o prêmio ou regras do sorteio..."
                    value={sDescricao}
                    onChange={e => setSDescricao(e.target.value)}
                    rows={6}
                    className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                               placeholder-white/20 focus:outline-none focus:border-br-yellow/50 resize-y min-h-[140px]"
                  />
                </div>

                {/* Data de encerramento */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/40">Data e hora de encerramento (opcional)</label>
                  <input
                    type="datetime-local"
                    value={sExpiraEm}
                    onChange={e => setSExpiraEm(e.target.value)}
                    className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                               focus:outline-none focus:border-br-yellow/50"
                  />
                </div>

                {/* VIP multiplicador */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/40">Multiplicador de entradas VIP</label>
                  <div className="flex gap-1">
                    {[2, 3, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSVipMult(n)}
                        className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors
                          ${sVipMult === n
                            ? 'bg-br-yellow text-black'
                            : 'bg-br-dark border border-white/15 text-white/60 hover:border-white/30'
                          }`}
                      >
                        {n}×
                      </button>
                    ))}
                  </div>
                </div>

                {/* Número de ganhadores */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/40">Número de ganhadores</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={sNumVencedores}
                    onChange={e => setSNumVencedores(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                               focus:outline-none focus:border-br-yellow/50"
                  />
                </div>

                {/* Modo de resultado */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/40">Modo de resultado</label>
                  <div className="flex gap-1">
                    {(['igual', 'colocacao'] as const).map(modo => (
                      <button
                        key={modo}
                        type="button"
                        onClick={() => setSModoResultado(modo)}
                        className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors
                          ${sModoResultado === modo
                            ? 'bg-br-yellow text-black'
                            : 'bg-br-dark border border-white/15 text-white/60 hover:border-white/30'
                          }`}
                      >
                        {modo === 'igual' ? '🤝 Iguais' : '🥇 Com colocação'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/30">
                    {sModoResultado === 'igual' ? 'Todos ganham o mesmo prêmio' : 'Ganhadores por colocação: 1º, 2º, 3º...'}
                  </p>
                </div>

                {/* Prêmio automático */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs text-white/40">Prêmio automático ao encerrar</label>
                  <div className="flex gap-1">
                    {([null, 'vip'] as const).map(p => (
                      <button
                        key={String(p)}
                        type="button"
                        onClick={() => setSPremio(p)}
                        className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors
                          ${sPremio === p
                            ? 'bg-br-yellow text-black'
                            : 'bg-br-dark border border-white/15 text-white/60 hover:border-white/30'
                          }`}
                      >
                        {p === null ? '🎁 Nenhum' : '👑 VIP'}
                      </button>
                    ))}
                  </div>
                </div>

                {sPremio === 'vip' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">Dias de VIP para os vencedores</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={sPremioDias}
                      onChange={e => setSPremioDias(Math.max(1, parseInt(e.target.value) || 30))}
                      className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                                 focus:outline-none focus:border-br-yellow/50"
                    />
                    <p className="text-xs text-white/30">VIP será concedido automaticamente ao sortear</p>
                  </div>
                )}
              </div>

              {/* VIP Bônus toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setSVipBonus(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                    ${sVipBonus ? 'bg-br-yellow' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all
                    ${sVipBonus ? 'left-6' : 'left-1'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Bônus para VIPs</p>
                  <p className="text-xs text-white/40">
                    VIPs terão {sVipMult}x mais chances de ganhar
                  </p>
                </div>
              </label>

              {sErr && <p className="text-red-400 text-sm">{sErr}</p>}

              <button
                type="submit"
                disabled={sCreateBusy}
                className="self-start bg-br-yellow text-black text-sm font-bold px-5 py-2.5 rounded-lg
                           hover:brightness-110 transition-all disabled:opacity-50"
              >
                {sCreateBusy ? 'Criando...' : '+ Criar sorteio'}
              </button>
            </form>
          )}
        </>
      )}

      {/* ─── Aba Propagandas ───────────────────────────────── */}
      {activeTab === 'propagandas' && (
        <>
          {/* Formulário de cadastro */}
          <form
            onSubmit={handleAddPropaganda}
            className="bg-br-dark2 border border-white/10 rounded-xl p-5 mb-6 flex flex-col gap-4"
          >
            <p className="text-sm font-semibold text-white/60 uppercase tracking-wider">
              Nova propaganda
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Comprador */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Comprador</label>
                <input
                  type="text"
                  placeholder="Nome ou @ do comprador"
                  value={propComprador}
                  onChange={e => setPropComprador(e.target.value)}
                  className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                             placeholder-white/20 focus:outline-none focus:border-br-yellow/50"
                />
              </div>

              {/* Contato via */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Contato via</label>
                <div className="flex gap-2">
                  {(['discord', 'instagram', 'tiktok'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPropContatoVia(c)}
                      className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors capitalize
                        ${propContatoVia === c
                          ? 'bg-br-yellow text-black'
                          : 'bg-br-dark border border-white/15 text-white/60 hover:border-white/30'
                        }`}
                    >
                      {c === 'discord' ? '🎮' : c === 'instagram' ? '📷' : '🎵'} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comprado em */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Comprado em</label>
                <input
                  type="date"
                  value={propCompradoEm}
                  onChange={e => setPropCompradoEm(e.target.value)}
                  className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                             focus:outline-none focus:border-br-yellow/50"
                />
              </div>

              {/* Expira em */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/40">Expira em</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={propExpiraEm}
                    onChange={e => setPropExpiraEm(e.target.value)}
                    className="flex-1 bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                               focus:outline-none focus:border-br-yellow/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const base = propCompradoEm || todayStr()
                      const d = new Date(base)
                      d.setDate(d.getDate() + 30)
                      setPropExpiraEm(d.toISOString().split('T')[0])
                    }}
                    className="px-3 py-2 text-xs font-bold bg-br-dark border border-white/15
                               text-white/60 hover:border-br-yellow/50 hover:text-br-yellow
                               rounded-lg transition-colors whitespace-nowrap"
                  >
                    +30d
                  </button>
                </div>
              </div>
            </div>

            {/* Imagem */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/40">Imagem (opcional)</label>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-br-dark border border-white/15 hover:border-white/30
                                  rounded-lg px-4 py-2 text-sm text-white/60 hover:text-white/90
                                  transition-colors">
                  Escolher imagem
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {propImagem && (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={propImagem}
                      alt="thumb"
                      className="w-14 h-10 object-cover rounded border border-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPropImagem(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="text-xs text-white/30 hover:text-white/60"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-white/25">
                A imagem é comprimida automaticamente para baixíssima resolução.
              </p>
            </div>

            {propErr && <p className="text-red-400 text-sm">{propErr}</p>}

            <button
              type="submit"
              disabled={propBusy}
              className="self-start bg-br-yellow text-black text-sm font-bold px-5 py-2.5 rounded-lg
                         hover:brightness-110 transition-all disabled:opacity-50"
            >
              {propBusy ? 'Salvando...' : '+ Adicionar propaganda'}
            </button>
          </form>

          {/* Lista de propagandas */}
          <div className="bg-br-dark2 border border-white/10 rounded-xl overflow-hidden">
            {propFetching ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-br-yellow border-t-transparent rounded-full animate-spin" />
              </div>
            ) : propagandas.length === 0 ? (
              <p className="text-center text-white/30 py-12">Nenhuma propaganda cadastrada</p>
            ) : (
              <div className="divide-y divide-white/5">
                {propagandas.map(p => {
                  const dias = diasRestantesProp(p.expiraEm)
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-4 px-4 py-3"
                    >
                      {/* Thumbnail */}
                      <div className="w-14 h-10 flex-shrink-0 rounded border border-white/10 bg-white/5 overflow-hidden">
                        {p.imagemThumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imagemThumb}
                            alt="thumb"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-lg">
                            📢
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{p.comprador}</span>
                          <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">
                            {CONTATO_LABEL[p.contatoVia] ?? p.contatoVia}
                          </span>
                          {p.notificado && (
                            <span className="text-xs bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded">
                              notificado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-white/35">
                          <span>compra: {formatDate(p.compradoEm)}</span>
                          <span>•</span>
                          <span>expira: {formatDate(p.expiraEm)}</span>
                        </div>
                      </div>

                      {/* Badge dias */}
                      <DaysBadge dias={dias} />

                      {/* Remover */}
                      <button
                        onClick={() => handleDeletePropaganda(p.id, p.comprador)}
                        className="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60
                                   px-2 py-1 rounded transition-colors flex-shrink-0"
                      >
                        Remover
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Aba Grupos ──────────────────────────────────────── */}
      {activeTab === 'grupos' && (
        <>
          {/* Adicionar grupo */}
          <div className="bg-br-dark2 border border-white/10 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Adicionar Grupo Verificado</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setGErr('')
                setGBusy(true)
                const res = await fetch('/api/controle/grupos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nome: gNome, slug: gSlug, senha: gSenha }),
                })
                const d = await res.json()
                if (res.ok) {
                  setGNome(''); setGSlug(''); setGSenha('')
                  await loadGrupos()
                } else {
                  setGErr(d.error ?? 'Erro ao adicionar grupo')
                }
                setGBusy(false)
              }}
              className="flex flex-wrap gap-3 items-end"
            >
              <div className="flex flex-col gap-1">
                <label className="text-white/40 text-xs uppercase tracking-wider">Nome</label>
                <input
                  value={gNome} onChange={e => setGNome(e.target.value)} required
                  placeholder="Ex: DRAKHALEM"
                  className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-br-yellow/50 w-44"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-white/40 text-xs uppercase tracking-wider">Slug (URL)</label>
                <input
                  value={gSlug} onChange={e => setGSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} required
                  placeholder="drakhalem"
                  className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-br-yellow/50 w-36"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-white/40 text-xs uppercase tracking-wider">Senha</label>
                <input
                  value={gSenha} onChange={e => setGSenha(e.target.value)} required
                  placeholder="Senha do grupo"
                  className="bg-br-dark border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-br-yellow/50 w-44"
                />
              </div>
              <button
                type="submit" disabled={gBusy}
                className="bg-br-yellow text-black text-sm font-bold px-4 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                {gBusy ? '...' : '+ Adicionar'}
              </button>
              {gErr && <p className="text-red-400 text-sm w-full">{gErr}</p>}
            </form>
          </div>

          {/* Lista de grupos */}
          <div className="bg-br-dark2 border border-white/10 rounded-xl overflow-hidden">
            {gruposFetch ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-br-yellow border-t-transparent rounded-full animate-spin" />
              </div>
            ) : grupos.length === 0 ? (
              <p className="text-center text-white/30 py-12">Nenhum grupo cadastrado</p>
            ) : (
              <div className="divide-y divide-white/5">
                {grupos.map(g => (
                  <div key={g.slug} className="px-5 py-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{g.nome}</span>
                        <span className="text-xs text-white/30 font-mono">/sorteio/{g.slug}</span>
                        {!g.ativo && (
                          <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded">inativo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/35">
                        <span>Canal: {g.canalId ?? 'não configurado'}</span>
                      </div>
                    </div>

                    {/* VIPs disponíveis por tier */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        {g.vipsPorTier ? (
                          <>
                            <span className={`font-bold ${(g.vipsPorTier[1] ?? 0) > 0 ? 'text-amber-600' : 'text-white/20'}`}>
                              {g.vipsPorTier[1] ?? 0} <span className="text-white/40">B</span>
                            </span>
                            <span className="text-white/10">·</span>
                            <span className={`font-bold ${(g.vipsPorTier[2] ?? 0) > 0 ? 'text-gray-300' : 'text-white/20'}`}>
                              {g.vipsPorTier[2] ?? 0} <span className="text-white/40">P</span>
                            </span>
                            <span className="text-white/10">·</span>
                            <span className={`font-bold ${(g.vipsPorTier[3] ?? 0) > 0 ? 'text-yellow-400' : 'text-white/20'}`}>
                              {g.vipsPorTier[3] ?? 0} <span className="text-white/40">O</span>
                            </span>
                          </>
                        ) : (
                          <span className={`font-bold ${g.vipsDisponiveis > 0 ? 'text-br-yellow' : 'text-white/30'}`}>
                            {g.vipsDisponiveis} VIP{g.vipsDisponiveis !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {gVipsSlug === g.slug ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={gVipsTier}
                            onChange={e => setGVipsTier(parseInt(e.target.value))}
                            className="bg-br-dark border border-white/15 rounded px-1 py-1 text-xs text-white focus:outline-none"
                          >
                            <option value={1}>Bronze</option>
                            <option value={2}>Prata</option>
                            <option value={3}>Ouro</option>
                          </select>
                          <input
                            type="number" min="1" value={gVipsQtd}
                            onChange={e => setGVipsQtd(parseInt(e.target.value) || 1)}
                            className="w-12 bg-br-dark border border-white/15 rounded px-2 py-1 text-xs text-white text-center focus:outline-none"
                          />
                          <button
                            disabled={gVipsBusy}
                            onClick={async () => {
                              setGVipsBusy(true)
                              const res = await fetch(`/api/controle/grupos/${g.slug}/vips`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ quantidade: gVipsQtd, tier: gVipsTier }),
                              })
                              if (res.ok) { setGVipsSlug(null); await loadGrupos() }
                              setGVipsBusy(false)
                            }}
                            className="text-xs bg-br-yellow text-black font-bold px-2 py-1 rounded hover:brightness-110 disabled:opacity-50"
                          >
                            {gVipsBusy ? '...' : '✓'}
                          </button>
                          <button onClick={() => setGVipsSlug(null)} className="text-xs text-white/40 hover:text-white/60">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setGVipsSlug(g.slug); setGVipsQtd(1); setGVipsTier(1) }}
                          className="text-xs bg-white/10 text-white/60 px-2 py-1 rounded hover:bg-white/20 transition-colors"
                        >
                          + VIPs
                        </button>
                      )}
                    </div>

                    {/* Toggle ativo / remover */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await fetch(`/api/controle/grupos/${g.slug}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ativo: !g.ativo }),
                          })
                          await loadGrupos()
                        }}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${g.ativo
                          ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                          : 'border-white/15 text-white/40 hover:bg-white/10'}`}
                      >
                        {g.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remover grupo ${g.nome}?`)) return
                          await fetch(`/api/controle/grupos/${g.slug}`, { method: 'DELETE' })
                          await loadGrupos()
                        }}
                        className="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60 px-2 py-1 rounded transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
