'use client'
import Image from 'next/image'
import { useRef } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

const VRCHAT_WORLD_URL = 'https://vrchat.com/home/launch?worldId=wrld_7206c98b-68bd-4468-8b2c-55c9d874d844'

const images = [
  { src: '/map/cinema.png',   alt: 'Cinema Coruja' },
  { src: '/map/comedy.png',   alt: 'VRComedy Club' },
  { src: '/map/chillrap.png', alt: 'Área de Festa'  },
  { src: '/map/hotelvip.png', alt: 'Hotel VIP'     },
  { src: '/map/bar.png',      alt: 'Bar'           },
  { src: '/map/aerial.png',   alt: 'Vista do Mapa' },
]

const reversed = [...images].reverse()

function Row({ imgs, dir }: { imgs: typeof images; dir: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  const pause  = () => { if (ref.current) ref.current.style.animationPlayState = 'paused' }
  const resume = () => { if (ref.current) ref.current.style.animationPlayState = 'running' }

  return (
    <div className="overflow-hidden" onMouseEnter={pause} onMouseLeave={resume}>
      <div
        ref={ref}
        className={`flex gap-4 w-max will-change-transform ${dir === 'left' ? 'animate-scroll-left' : 'animate-scroll-right'}`}
      >
        {[...imgs, ...imgs].map((img, i) => (
          <Card key={i} img={img} />
        ))}
      </div>
    </div>
  )
}

export default function Gallery() {
  const { t } = useLanguage()

  return (
    <section id="galeria" className="py-24 bg-br-dark overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 text-center mb-14 reveal">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-white">{t.gallery.titleA}</span>{' '}
          <span className="text-br-yellow">{t.gallery.titleB}</span>
        </h2>
        <p className="text-gray-400 text-lg mb-8">{t.gallery.subtitle}</p>
        <a
          href={VRCHAT_WORLD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-br-yellow text-br-dark font-bold px-10 py-4 rounded-xl text-lg hover:brightness-110 transition-all shadow-lg glow-yellow-strong btn-shine"
        >
          🗺️ {t.gallery.btnVisit}
        </a>
      </div>

      <Row imgs={images}   dir="left"  />
      <div className="mt-4">
        <Row imgs={reversed} dir="right" />
      </div>
    </section>
  )
}

function Card({ img }: { img: { src: string; alt: string } }) {
  return (
    <div className="group relative flex-shrink-0 w-80 h-52 rounded-2xl overflow-hidden border border-white/5 shadow-xl transition-all duration-300 hover:border-br-yellow/40 hover:shadow-[0_0_20px_rgba(255,215,0,0.15)]">
      <Image
        src={img.src}
        alt={img.alt}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="320px"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
        <span className="text-white text-sm font-semibold tracking-wide">{img.alt}</span>
      </div>
      <div className="absolute top-0 right-0 w-16 h-16 bg-br-yellow/0 group-hover:bg-br-yellow/10 rounded-bl-3xl transition-all duration-300 blur-md" />
    </div>
  )
}
