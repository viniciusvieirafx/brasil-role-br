'use client'

import { useEffect, useState, useCallback } from 'react'

type VipEntry = {
  discordId:    string
  username:     string | null
  globalName:   string | null
  nick:         string | null
  expiresAt:    string
  diasRestantes: number
  ativo:        boolean
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

function DaysBadge({ dias }: { dias: number }) {
  let cls = 'px-2 py-0.5 rounded text-xs font-bold '
  if (dias > 14)      cls += 'bg-green-900/60 text-green-300'
  else if (dias > 6)  cls += 'bg-yellow-900/60 text-yellow-300'
  else if (dias > 0)  cls += 'bg-orange-900/60 text-orange-300'
  else                cls += 'bg-red-900/60 text-red-400'
  const label = dias > 0 ? `${dias}d` : dias === 0 ? 'hoje' : `${Math.abs(dias)}d atrás`
  return <span className={cls}>{label}</span>
}

export default function ControlePage() {
  const [status, setStatus]     = useState<'loading' | 'login' | 'dashboard'>('loading')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')
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

  const loadVips = useCallback(async () => {
    setFetching(true)
    const res = await fetch('/api/controle/vips')
    if (res.ok) setVips(await res.json())
    setFetching(false)
  }, [])

  useEffect(() => {
    fetch('/api/controle/auth')
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) { setStatus('dashboard'); loadVips() }
        else setStatus('login')
      })
      .catch(() => setStatus('login'))
  }, [loadVips])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr('')
    const res = await fetch('/api/controle/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })
    if (res.ok) { setStatus('dashboard'); loadVips() }
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
    let data: any[]
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
        <h1 className="text-2xl font-bold text-br-yellow tracking-wide">Controle VIP</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Sair
        </button>
      </div>

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

      {/* Tabela */}
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
    </div>
  )
}
