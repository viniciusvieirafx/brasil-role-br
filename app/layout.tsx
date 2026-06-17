import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import ClickSound from '@/components/ClickSound'
import ScrollRevealInit from '@/components/ScrollRevealInit'
import { LanguageProvider } from '@/contexts/LanguageContext'
import type { Lang } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Brasil Role BR | VRChat',
  description: 'O maior mapa brasileiro do VRChat — otimizado, cheio de conteúdo e feito para ser o nosso lar. Por MiraNaJanela.',
  openGraph: {
    title: 'Brasil Role BR',
    description: 'O melhor servidor Brasileiro de VRChat',
    images: ['/cover.png'],
  },
}

const PT_COUNTRIES = new Set(['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL'])
const ES_COUNTRIES = new Set(['ES', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'CR', 'PA', 'HN', 'GT', 'SV', 'NI', 'DO', 'CU', 'PR', 'GQ'])

function countryToLang(country: string | null): Lang {
  if (!country) return 'pt'
  if (PT_COUNTRIES.has(country)) return 'pt'
  if (ES_COUNTRIES.has(country)) return 'es'
  return 'en'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const country = hdrs.get('x-vercel-ip-country')
  const serverLang = countryToLang(country)

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} bg-br-dark text-white`}>
        <LanguageProvider serverLang={serverLang}>
          <ClickSound />
          <ScrollRevealInit />
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
