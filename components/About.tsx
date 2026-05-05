'use client'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

function StatCard({ label, target, suffix }: { label: string; target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    started.current = false
    setCount(0)
  }, [label])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1600
          const start = performance.now()
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [target])

  return (
    <div
      ref={ref}
      className="reveal-scale bg-br-purple/60 rounded-2xl p-6 text-center border border-br-yellow/10 hover:border-br-yellow/40 transition-all duration-300 hover:-translate-y-2 cursor-default group card-shimmer"
    >
      <div className="text-4xl font-bold text-br-yellow mb-1 tabular-nums group-hover:drop-shadow-[0_0_14px_rgba(255,215,0,0.85)] transition-all duration-300">
        {count}{suffix}
      </div>
      <div className="text-gray-400 text-sm">{label}</div>
    </div>
  )
}

export default function About() {
  const { t } = useLanguage()

  const stats = [
    { label: t.about.stat1, target: 400, suffix: '+' },
    { label: t.about.stat2, target: 18,  suffix: 'k+' },
    { label: t.about.stat3, target: 50,  suffix: '+' },
    { label: t.about.stat4, target: 250, suffix: '+' },
  ]

  return (
    <section id="sobre" className="py-24 bg-br-dark2 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-br-green/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-br-yellow/4 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="reveal-left">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              <span className="text-white">{t.about.titleA}</span>{' '}
              <span className="text-br-yellow">{t.about.titleB}</span>
            </h2>
            <div className="space-y-5 text-gray-300 text-lg leading-relaxed">
              <p>
                {t.about.p1_before}
                <strong className="text-br-yellow">MiraNaJanela</strong>
                {t.about.p1_after}
              </p>
              <p>
                {t.about.p2_before}
                <strong className="text-white">{t.about.p2_bold}</strong>
                {t.about.p2_after}
              </p>
              <p>{t.about.p3}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat, i) => (
              <StatCard key={i} {...stat} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
