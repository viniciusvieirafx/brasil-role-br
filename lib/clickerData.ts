export interface UpgradeDef {
  id: string
  name: string
  icon: string
  description: string
  maxLevel: number
  baseCost: number
  costScale: number   // custo do nível n = Math.ceil(baseCost * costScale^n)
  type: 'click' | 'auto_click' | 'passive' | 'multiplier' | 'click_modifier' | 'fury'
  valuePerLevel?: number  // apenas para click e passive
}

// Fórmulas (inspirado em Cookie Clicker):
//   Edifícios passivos → costScale 1.15, max 500 níveis, começa barato
//   Upgrades especiais → costScale mais alto, max 10-20 níveis
//
// computeStats usa fórmulas diretas para auto_click / crit / fury / multiplier:
//   multiplier : ×(1 + nível × 0.20)        — até ×4.0 no nível 15
//   critChance : nível × 3 %, cap 50 %
//   autoClickMs: max(300, 6000 − nível×280)  — 5720 ms no nível 1, 400 ms no nível 20
//   furyEvery  : max(3,  22  − nível×2)      — 20 cliques no nível 1, 3 no nível 10

export const UPGRADES: UpgradeDef[] = [
  // ── CLIQUE ───────────────────────────────────────────────────────────────
  {
    id: 'click_power',
    name: 'Mãos Fortes',
    icon: '👊',
    description: '+1 moeda por clique por nível',
    maxLevel: 500,
    baseCost: 15,
    costScale: 1.15,
    type: 'click',
    valuePerLevel: 1,
  },
  {
    id: 'critical',
    name: 'Clique Crítico',
    icon: '💥',
    description: '+3% chance de triplicar o clique',
    maxLevel: 15,
    baseCost: 500,
    costScale: 1.85,
    type: 'click_modifier',
  },
  {
    id: 'fury',
    name: 'Fúria',
    icon: '🔥',
    description: 'A cada N cliques o próximo vale 5×',
    maxLevel: 10,
    baseCost: 300,
    costScale: 1.85,
    type: 'fury',
  },
  {
    id: 'auto_click',
    name: 'Auto-Click',
    icon: '🤖',
    description: 'Clica automaticamente',
    maxLevel: 20,
    baseCost: 200,
    costScale: 1.65,
    type: 'auto_click',
  },

  // ── PRODUÇÃO PASSIVA (estilo edifícios do Cookie Clicker) ─────────────────
  {
    id: 'miner',
    name: 'Minerador',
    icon: '⛏️',
    description: '+0.1 moedas/s por nível',
    maxLevel: 500,
    baseCost: 100,
    costScale: 1.15,
    type: 'passive',
    valuePerLevel: 0.1,
  },
  {
    id: 'factory',
    name: 'Fábrica',
    icon: '🏭',
    description: '+1 moeda/s por nível',
    maxLevel: 500,
    baseCost: 1100,
    costScale: 1.15,
    type: 'passive',
    valuePerLevel: 1,
  },
  {
    id: 'powerplant',
    name: 'Usina',
    icon: '⚡',
    description: '+10 moedas/s por nível',
    maxLevel: 500,
    baseCost: 12000,
    costScale: 1.15,
    type: 'passive',
    valuePerLevel: 10,
  },
  {
    id: 'portal',
    name: 'Portal',
    icon: '🌀',
    description: '+80 moedas/s por nível',
    maxLevel: 500,
    baseCost: 130000,
    costScale: 1.15,
    type: 'passive',
    valuePerLevel: 80,
  },
  {
    id: 'timemachine',
    name: 'Máquina do Tempo',
    icon: '⏳',
    description: '+500 moedas/s por nível',
    maxLevel: 500,
    baseCost: 1400000,
    costScale: 1.15,
    type: 'passive',
    valuePerLevel: 500,
  },

  // ── GLOBAL ───────────────────────────────────────────────────────────────
  {
    id: 'multiplier',
    name: 'Amplificador',
    icon: '✨',
    description: '+20% em todos os ganhos por nível',
    maxLevel: 15,
    baseCost: 5000,
    costScale: 2.00,
    type: 'multiplier',
  },
]

export interface ClickerStats {
  mpc: number
  mps: number
  multiplier: number
  critChance: number
  autoClickMs: number | null
  furyEvery: number | null
}

export function computeStats(upgrades: Record<string, number>): ClickerStats {
  const upg = (id: string) => upgrades[id] ?? 0

  const mpc = 1 + upg('click_power')

  const mps =
    upg('miner')       * 0.1  +
    upg('factory')     * 1    +
    upg('powerplant')  * 10   +
    upg('portal')      * 80   +
    upg('timemachine') * 500

  const multiplier = 1 + upg('multiplier') * 0.20

  const critChance = Math.min(0.50, upg('critical') * 0.03)

  const alvl = upg('auto_click')
  const autoClickMs = alvl === 0 ? null : Math.max(300, 6000 - alvl * 280)

  const flvl = upg('fury')
  const furyEvery = flvl === 0 ? null : Math.max(3, 22 - flvl * 2)

  return { mpc, mps, multiplier, critChance, autoClickMs, furyEvery }
}

export function upgradeCost(upgrade: UpgradeDef, currentLevel: number): number {
  if (currentLevel >= upgrade.maxLevel) return Infinity
  return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costScale, currentLevel))
}

// Helpers para mostrar o efeito do próximo nível na UI
export function upgradeEffectText(upgrade: UpgradeDef, nextLevel: number): string {
  switch (upgrade.type) {
    case 'click':
      return `+${nextLevel} moedas/clique`
    case 'passive':
      return `+${((upgrade.valuePerLevel ?? 0) * nextLevel).toFixed(nextLevel < 10 ? 1 : 0)}/s total`
    case 'multiplier':
      return `×${(1 + nextLevel * 0.20).toFixed(2)} total`
    case 'click_modifier':
      return `${Math.min(50, nextLevel * 3)}% crit`
    case 'fury':
      return `a cada ${Math.max(3, 22 - nextLevel * 2)} cliques`
    case 'auto_click':
      return `a cada ${(Math.max(300, 6000 - nextLevel * 280) / 1000).toFixed(1)}s`
    default:
      return ''
  }
}

export function formatMoedas(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000)     return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)         return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)             return `${(n / 1_000).toFixed(1)}k`
  return Math.floor(n).toString()
}

// 200 pts → 5k moedas  (injetar pts é bom negócio)
// 50k moedas → 50 pts  (converter de volta é late-game)
export const BUY_RATE  = { pts: 200,   moedas: 5000 }
export const SELL_RATE = { moedas: 50000, pts: 50 }
