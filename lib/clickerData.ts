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

// Economy target:
// - ~200 clicks to first upgrade (at 1 mpc, 2 clicks/s = ~1.7 min)
// - Mid-game unlocks after many hours of active play
// - Full passive income meaningful only after days/weeks of farming
// - Sell rate: only worth doing at high passive income (100+ mps)

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'click_power',
    name: 'Mãos Fortes',
    icon: '👊',
    description: '+1 moeda por clique por nível',
    maxLevel: 10,
    //                  lv1    lv2     lv3      lv4      lv5       lv6       lv7        lv8        lv9         lv10
    costs: [200, 700, 2500, 8000, 25000, 80000, 250000, 800000, 2500000, 8000000],
    type: 'click',
    valuePerLevel: 1,
  },
  {
    id: 'critical',
    name: 'Clique Crítico',
    icon: '💥',
    description: 'Chance de triplicar o valor do clique',
    maxLevel: 3,
    costs: [10000, 80000, 600000],
    type: 'click_modifier',
    valuesPerLevel: [0.08, 0.18, 0.32],
  },
  {
    id: 'fury',
    name: 'Fúria',
    icon: '🔥',
    description: 'A cada N cliques, o próximo vale 5×',
    maxLevel: 3,
    costs: [6000, 40000, 200000],
    type: 'fury',
    valuesPerLevel: [12, 8, 5],
  },
  {
    id: 'auto_click',
    name: 'Auto-Click',
    icon: '🤖',
    description: 'Clica automaticamente em intervalos',
    maxLevel: 5,
    //                  lv1    lv2      lv3       lv4        lv5
    costs: [2500, 10000, 40000, 150000, 600000],
    type: 'auto_click',
    valuesPerLevel: [6000, 5000, 3500, 2500, 1500],  // ms between auto-clicks
  },
  {
    id: 'miner',
    name: 'Minerador',
    icon: '⛏️',
    description: '+0.3 moedas/s por nível',
    maxLevel: 8,
    //                  lv1    lv2     lv3      lv4       lv5       lv6        lv7         lv8
    costs: [800, 3000, 10000, 35000, 120000, 400000, 1300000, 4500000],
    type: 'passive',
    valuePerLevel: 0.3,
  },
  {
    id: 'factory',
    name: 'Fábrica',
    icon: '🏭',
    description: '+2 moedas/s por nível',
    maxLevel: 5,
    //                   lv1      lv2       lv3         lv4          lv5
    costs: [20000, 90000, 380000, 1600000, 7000000],
    type: 'passive',
    valuePerLevel: 2,
  },
  {
    id: 'powerplant',
    name: 'Usina',
    icon: '⚡',
    description: '+12 moedas/s por nível',
    maxLevel: 4,
    //                    lv1       lv2          lv3           lv4
    costs: [200000, 1200000, 7000000, 40000000],
    type: 'passive',
    valuePerLevel: 12,
  },
  {
    id: 'multiplier',
    name: 'Amplificador',
    icon: '✨',
    description: 'Multiplica todos os ganhos',
    maxLevel: 3,
    costs: [60000, 500000, 3500000],
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
  const mps = upg('miner') * 0.3 + upg('factory') * 2 + upg('powerplant') * 12
  const mlvl = upg('multiplier')
  const multiplier = mlvl === 0 ? 1 : ([1.5, 2.5, 4.0] as number[])[mlvl - 1]
  const clvl = upg('critical')
  const critChance = clvl === 0 ? 0 : ([0.08, 0.18, 0.32] as number[])[clvl - 1]
  const alvl = upg('auto_click')
  const autoClickMs = alvl === 0 ? null : ([6000, 5000, 3500, 2500, 1500] as number[])[alvl - 1]
  const flvl = upg('fury')
  const furyEvery = flvl === 0 ? null : ([12, 8, 5] as number[])[flvl - 1]
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

// 200 pts → 5k moedas  (injetar pts é bom negócio)
// 50k moedas → 50 pts  (converter de volta é caro, só vale no late game)
export const BUY_RATE  = { pts: 200,   moedas: 5000 }
export const SELL_RATE = { moedas: 50000, pts: 50 }
