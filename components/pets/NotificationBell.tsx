'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServerNotification } from '@/app/api/pets/notifications/route'

const TYPE_ICON: Record<string, string> = {
  battle_defended: '🛡️',
  egg_ready:       '🥚',
  battle_win:      '🏆',
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return 'agora'
  if (secs < 3600) return `${Math.floor(secs / 60)}m atrás`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h atrás`
  return `${Math.floor(secs / 86400)}d atrás`
}

export default function NotificationBell() {
  const [notifs, setNotifs]   = useState<ServerNotification[]>([])
  const [open, setOpen]       = useState(false)
  const [loaded, setLoaded]   = useState(false)
  const [unread, setUnread]   = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Busca notificações server-push (uma vez por sessão)
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/pets/notifications')
      if (!res.ok) return
      const data: ServerNotification[] = await res.json()
      if (data.length > 0) {
        setNotifs(data)
        setUnread(data.length)
      }
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    setOpen(o => !o)
    if (!open) setUnread(0) // marca como lidas ao abrir
  }

  function dismiss(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  if (!loaded && notifs.length === 0) return null

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={handleOpen}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
          open ? 'bg-yellow-400/20 text-yellow-400' : 'text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
        title="Notificações"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-[#130F2A] border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 sticky top-0 bg-[#130F2A]">
            <p className="text-white font-bold text-sm">Notificações</p>
            {notifs.length > 0 && (
              <button onClick={() => setNotifs([])} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
                Limpar
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-3xl mb-2">🔕</p>
              <p className="text-zinc-500 text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/60">
              {notifs.map(n => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-snug">{n.message}</p>
                    {n.points && (
                      <p className="text-yellow-400 text-xs font-bold mt-0.5">+{n.points} pts</p>
                    )}
                    <p className="text-zinc-500 text-xs mt-0.5">{timeAgo(n.timestamp)}</p>
                  </div>
                  <button onClick={() => dismiss(n.id)} className="text-zinc-600 hover:text-zinc-300 text-sm shrink-0 mt-0.5 transition-colors" title="Dispensar">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
