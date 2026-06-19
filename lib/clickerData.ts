export interface UpgradeDef {
  id: string
  name: string
  icon: string
  description: string
  maxLevel: number
  costs: number[]        // cost[i] = cost to buy level i+1
  type: 'click' | 'auto_click' | 'passive' | 'multiplier' | 'click_modifier' | 'fury'
  valuePerLevel?: number
  valuesPerLevel?: number[]
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'click_power',
    name: 'Mãos Fortes',
    icon: '👊',
    description: '+1 moeda por clique por nível',
    maxLevel: 10,
    costs: [10, 25, 55, 120, 270, 600, 1320, 2900, 6400, 14000],
    type: 'click',
    valuePerLevel: 1,
  },
  {
    id: 'critical',
    name: 'Clique Crítico',
    icon: '💥',
    description: 'Chance de triplicar o valor do clique',
    maxLevel: 3,
    costs: [600, 2500, 10000],
    type: 'click_modifier',
    valuesPerLevel: [0.10, 0.22, 0.38],
  },
  {
    id: 'fury',
    name: 'Fúria',
    icon: '🔥',
    description: 'A cada N cliques, o próximo vale 5×',
    maxLevel: 3,
    costs: [400, 2000, 7000],
    type: 'fury',
    valuesPerLevel: [10, 7, 5],
  },
  {
    id: 'auto_click',
    name: 'Auto-Click',
    icon: '🤖',
    description: 'Clica automaticamente em intervalos',
    maxLevel: 5,
    costs: [100, 300, 800, 2000, 5000],
    type: 'auto_click',
    valuesPerLevel: [3000, 2500, 2000, 1500, 1000],
  },
  {
    id: 'miner',
    name: 'Minerador',
    icon: '⛏️',
    description: '+0.5 moedas/s por nível',
    maxLevel: 8,
    costs: [200, 500, 1200, 3000, 7000, 16000, 38000, 90000],
    type: 'passive',
    valuePerLevel: 0.5,
  },
  {
    id: 'factory',
    name: 'Fábrica',
    icon: '🏭',
    description: '+4 moedas/s por nível',
    maxLevel: 5,
    costs: [2500, 8000, 25000, 75000, 225000],
    type: 'passive',
    valuePerLevel: 4,
  },
  {
    id: 'powerplant',
    name: 'Usina',
    icon: '⚡',
    description: '+25 moedas/s por nível',
    maxLevel: 4,
    costs: [20000, 75000, 280000, 1000000],
    type: 'passive',
    valuePerLevel: 25,
  },
  {
    id: 'multiplier',
    name: 'Amplificador',
    icon: '✨',
    description: 'Multiplica todos os ganhos',
    maxLevel: 3,
    costs: [3000, 15000, 75000],
    type: 'multiplier',
    valuesPerLevel: [1.5, 2.5, 4.0],
  },
]

export interface ClickerStats {
  mpc: number            // moedas per click (base, before crit/fury)
  mps: number            // moedas per second (passive, before multiplier)
  multiplier: number     // global multiplier (>=1)
  critChance: number     // 0-1
  autoClickMs: number | null   // interval in ms, null = disabled
  furyEvery: number | null     // clicks between fury procs, null = disabled
}

export function computeStats(upgrades: Record<string, number>): ClickerStats {
  const upg = (id: string) => upgrades[id] ?? 0
  const mpc = 1 + upg('click_power')
  const mps = upg('miner') * 0.5 + upg('factory') * 4 + upg('powerplant') * 25
  const mlvl = upg('multiplier')
  const multiplier = mlvl === 0 ? 1 : ([1.5, 2.5, 4.0] as number[])[mlvl - 1]
  const clvl = upg('critical')
  const critChance = clvl === 0 ? 0 : ([0.10, 0.22, 0.38] as number[])[clvl - 1]
  const alvl = upg('auto_click')
  const autoClickMs = alvl === 0 ? null : ([3000, 2500, 2000, 1500, 1000] as number[])[alvl - 1]
  const flvl = upg('fury')
  const furyEvery = flvl === 0 ? null : ([10, 7, 5] as number[])[flvl - 1]
  return { mpc, mps, multiplier, critChance, autoClickMs, furyEvery }
}

export function upgradeCost(upgrade: UpgradeDef, currentLevel: number): number {
  if (currentLevel >= upgrade.maxLevel) return Infinity
  return upgrade.costs[currentLevel]
}

export function formatMoedas(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return Math.floor(n).toString()
}

export const BUY_RATE  = { pts: 200,  moedas: 1000 }   // 200 pts -> 1000 moedas
export const SELL_RATE = { moedas: 5000, pts: 50 }      // 5000 moedas -> 50 pts
