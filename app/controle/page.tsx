'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type VipEntry = {
  discordId:    string
  username:     string | null
  globalName:   string | null
  nick:         string | null
  expiresAt:    string
  diasRestantes: number
  ativo:        boolean
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

type Tab = 'vips' | 'propagandas'

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

  const loadPropagandas = useCallback(async () => {
    setPropFetching(true)
    const res = await fetch('/api/controle/propagandas')
    if (res.ok) setPropagandas(await res.json())
    setPropFetching(false)
  }, [])

  useEffect(() => {
    fetch('/api/controle/auth')
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) { setStatus('dashboard'); loadVips(); loadPropagandas() }
        else setStatus('login')
      })
      .catch(() => setStatus('login'))
  }, [loadVips, loadPropagandas])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr('')
    const res = await fetch('/api/controle/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })
    if (res.ok) { setStatus('dashboard'); loadVips(); loadPropagandas() }
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
    setPassword('')
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
      body:    JSON.stringify({ expiresAt: daysFromNow(newDays) }),
    })
    if (res.ok) {
      setNewId('')
      setNewDays(30)
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
  const ativos   = vips.filter(v => v.diasRestantes > 0).length
  const vencendo = vips.filter(v => v.diasRestantes > 0 && v.diasRestantes <= 7).length
  const vencidos = vips.filter(v => v.diasRestantes <= 0).length

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
        {([['vips', 'VIPs'], ['propagandas', 'Propagandas']] as [Tab, string][]).map(([key, label]) => (
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
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Ativos',   value: ativos,   color: 'text-green-400' },
              { label: 'Vencendo', value: vencendo, color: 'text-yellow-400' },
              { label: 'Vencidos', value: vencidos, color: 'text-red-400' },
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
                      <th className="text-left px-4 py-3">Vencimento</th>
                      <th className="text-left px-4 py-3">Dias</th>
                      <th className="text-right px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vips.map((v, i) => (
                      <tr
                        key={v.discordId}
                        className={`border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                      >
                        <td className="px-4 py-3 font-medium">{displayName(v)}</td>
                        <td className="px-4 py-3 text-white/40 font-mono text-xs hidden md:table-cell">
                          {v.discordId}
                        </td>
                        <td className="px-4 py-3">
                          {editingId === v.discordId ? (
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
                        <td className="px-4 py-3">
                          <DaysBadge dias={v.diasRestantes} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {busy === `add-${v.discordId}` ? (
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
                            )}
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
    </div>
  )
}
