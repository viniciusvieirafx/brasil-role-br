import { ELEMENTS, PET_DB, type Rarity, type Element } from './petData'

// Tabela de vantagens: chave vence os valores
// Cada elemento vence 2 outros
const ADVANTAGES: Record<Element, Element[]> = {
  'Fogo':    ['Natureza', 'Gelo'],
  'Água':    ['Fogo',     'Terra'],
  'Terra':   ['Gelo',     'Ar'],
  'Ar':      ['Água',     'Natureza'],
  'Luz':     ['Sombra',   'Natureza'],
  'Sombra':  ['Luz',      'Ar'],
  'Gelo':    ['Água',     'Sombra'],
  'Natureza':['Terra',    'Água'],
}

export function getElementAdvantage(attacker: Element, defender: Element): 'strong' | 'weak' | 'neutral' {
  if (!attacker || !defender || !ADVANTAGES[attacker] || !ADVANTAGES[defender]) return 'neutral'
  if (ADVANTAGES[attacker].includes(defender)) return 'strong'
  if (ADVANTAGES[defender].includes(attacker)) return 'weak'
  return 'neutral'
}

export interface BattlePet {
  instanceId: string
  petId: number
  name: string
  level: number
  element: Element
  hp: number
  maxHp: number
}

export interface BattleLog {
  turn: number
  attacker: 'player' | 'enemy'
  damage: number
  advantage: 'strong' | 'weak' | 'neutral'
  playerHpAfter: number
  enemyHpAfter: number
}

export interface BattleResult {
  winner: 'player' | 'enemy'
  logs: BattleLog[]
}

function calcMaxHp(level: number): number {
  return 100 + level * 20
}

function rollDamage(level: number): number {
  const base = 10 + Math.floor(level * 2.5)
  return base + Math.floor(Math.random() * (base * 0.6))
}

export function makeBattlePet(
  instanceId: string, petId: number, name: string, level: number, element: Element
): BattlePet {
  const maxHp = calcMaxHp(level)
  return { instanceId, petId, name, level, element, hp: maxHp, maxHp }
}

export function simulateBattle(player: BattlePet, enemy: BattlePet): BattleResult {
  let pHp = player.maxHp
  let eHp = enemy.maxHp
  const logs: BattleLog[] = []
  let turn = 1

  // Quem ataca primeiro: maior nível; empate = random
  let playerFirst = player.level > enemy.level
    ? true
    : player.level < enemy.level
      ? false
      : Math.random() < 0.5

  while (pHp > 0 && eHp > 0 && turn <= 50) {
    const attackerSide = (turn % 2 === (playerFirst ? 1 : 0)) ? 'player' : 'enemy'
    const attElem  = attackerSide === 'player' ? player.element : enemy.element
    const defElem  = attackerSide === 'player' ? enemy.element  : player.element
    const attLevel = attackerSide === 'player' ? player.level   : enemy.level

    const adv = getElementAdvantage(attElem, defElem)
    let dmg = rollDamage(attLevel)
    if (adv === 'strong') dmg = Math.floor(dmg * 1.5)
    if (adv === 'weak')   dmg = Math.floor(dmg * 0.65)

    if (attackerSide === 'player') eHp = Math.max(0, eHp - dmg)
    else                           pHp = Math.max(0, pHp - dmg)

    logs.push({
      turn,
      attacker: attackerSide,
      damage: dmg,
      advantage: adv,
      playerHpAfter: pHp,
      enemyHpAfter: eHp,
    })
    turn++
  }

  return { winner: pHp > 0 ? 'player' : 'enemy', logs }
}

// Oponentes NPC gerados para desafio solo
export interface NpcOpponent {
  id: string
  trainerName: string
  pet: BattlePet
  reward: number   // pontos ganhos ao vencer
}

const NPC_NAMES = [
  'Ash', 'Misty', 'Brock', 'Gary', 'Lance', 'Clair', 'Sabrina',
  'Falkner', 'Bugsy', 'Whitney', 'Morty', 'Chuck', 'Jasmine',
  'Pryce', 'Bruno', 'Karen', 'Will', 'Lorelei',
]

function pickRarityForTier(tier: number): Rarity {
  if (tier <= 2)  return 'Comum'
  if (tier <= 4)  return 'Incomum'
  if (tier <= 6)  return 'Raro'
  if (tier <= 8)  return 'Épico'
  return 'Lendário'
}

export function generateNpcOpponents(playerLevel: number): NpcOpponent[] {
  const tiers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  return tiers.map(tier => {
    const level = Math.max(1, playerLevel - 2 + tier)
    const rarity = pickRarityForTier(tier)
    const candidates = PET_DB.filter(p => p.rarity === rarity)
    const petDef = candidates[Math.floor(Math.random() * candidates.length)]
    const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
    const name = NPC_NAMES[(tier - 1) % NPC_NAMES.length]

    return {
      id: `npc_${tier}`,
      trainerName: `${name} Nv.${tier}`,
      pet: makeBattlePet(`npc_pet_${tier}`, petDef.id, petDef.name, level, element),
      reward: tier * 15,
    }
  })
}
