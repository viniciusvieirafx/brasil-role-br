export type Rarity = 'Comum' | 'Incomum' | 'Raro' | 'Épico' | 'Lendário'
export type Element = 'Fogo' | 'Água' | 'Terra' | 'Ar' | 'Luz' | 'Sombra' | 'Gelo' | 'Natureza'

export const ELEMENTS: Element[] = ['Fogo', 'Água', 'Terra', 'Ar', 'Luz', 'Sombra', 'Gelo', 'Natureza']

export interface PetDefinition {
  id: number
  name: string
  rarity: Rarity
}

export interface EggDefinition {
  type: Rarity
  color: string
  borderColor: string
  possiblePets: number[]
  incubationSeconds: number  // tempo real (produção)
  label: string
  xpOnDuplicate: number      // XP dado ao pet existente se duplicar com mesmo elemento
}

const rarity = (id: number): Rarity => {
  if (id <= 50) return 'Comum'
  if (id <= 70) return 'Incomum'
  if (id <= 85) return 'Raro'
  if (id <= 95) return 'Épico'
  return 'Lendário'
}

const NAMES: Record<number, string> = {
  1:'Tominho', 2:'Maçãzinha', 3:'Moranguinho', 4:'Frutinela', 5:'Laranjo',
  6:'Coguin', 7:'Pãozinho', 8:'Bolinho', 9:'Melito', 10:'Docinho',
  11:'Folhinha', 12:'Florão', 13:'Sementinha', 14:'Raizcão', 15:'Galhito',
  16:'Musguinho', 17:'Funguito', 18:'Espinela', 19:'Bambuzão', 20:'Cactusin',
  21:'Bolhão', 22:'Ondina', 23:'Gotinha', 24:'Coralino', 25:'Algão',
  26:'Brasa', 27:'Faiscão', 28:'Chaminha', 29:'Cinzeiro', 30:'Fumacinha',
  31:'Pedrita', 32:'Terrina', 33:'Laminha', 34:'Argilo', 35:'Cristalino',
  36:'Ventinho', 37:'Brisão', 38:'Neblinela', 39:'Rajadinha', 40:'Sussurano',
  41:'Nevinho', 42:'Gelito', 43:'Geadão', 44:'Branquelo', 45:'Frescão',
  46:'Sombrinha', 47:'Noitinho', 48:'Eclipso', 49:'Escurão', 50:'Umbrino',
  51:'Luzelinha', 52:'Aurorinha', 53:'Brilhote', 54:'Raiozinho', 55:'Solzão',
  56:'Fundinho', 57:'Perlinha', 58:'Maresinha', 59:'Conchela', 60:'Coralão',
  61:'Jadeinho', 62:'Ópalinha', 63:'Safirão', 64:'Granão', 65:'Ágato',
  66:'Cristalão', 67:'Arcanito', 68:'Tornadão', 69:'Vórtex', 70:'Ciclonzão',
  71:'Vulcãozão', 72:'Labaredo', 73:'Braseiro', 74:'Piropaz', 75:'Igniton',
  76:'Glacião', 77:'Blizardo', 78:'Avalanchin', 79:'Tundro', 80:'Permafrost',
  81:'Abissão', 82:'Umbralão', 83:'Sombranão', 84:'Crepúsculo', 85:'Obscuro',
  86:'Celestino', 87:'Radiantus', 88:'Aurelião', 89:'Fulgorão', 90:'Nimbusin',
  91:'Arcanius', 92:'Tempestão', 93:'Trovadão', 94:'Raio Veloz', 95:'Terraformo',
  96:'Gaiazão', 97:'Krakenão', 98:'Infernus', 99:'Etéreo', 100:'Primordial',
}

export const PET_DB: PetDefinition[] = Array.from({ length: 100 }, (_, i) => {
  const id = i + 1
  return { id, name: NAMES[id], rarity: rarity(id) }
})

export const getPet = (id: number) => PET_DB.find(p => p.id === id)!

export const RARITY_STYLE: Record<Rarity, { border: string; bg: string; text: string; glow: string }> = {
  'Comum':    { border: 'border-zinc-500',   bg: 'bg-zinc-800/60',   text: 'text-zinc-300',  glow: '' },
  'Incomum':  { border: 'border-green-500',  bg: 'bg-green-900/40',  text: 'text-green-400', glow: 'shadow-green-500/30' },
  'Raro':     { border: 'border-blue-500',   bg: 'bg-blue-900/40',   text: 'text-blue-400',  glow: 'shadow-blue-500/30' },
  'Épico':    { border: 'border-purple-500', bg: 'bg-purple-900/40', text: 'text-purple-400',glow: 'shadow-purple-500/30' },
  'Lendário': { border: 'border-yellow-400', bg: 'bg-yellow-900/30', text: 'text-yellow-400',glow: 'shadow-yellow-400/40' },
}

export const ELEMENT_EMOJI: Record<Element, string> = {
  'Fogo':'🔥', 'Água':'💧', 'Terra':'🪨', 'Ar':'🌪️',
  'Luz':'✨', 'Sombra':'🌑', 'Gelo':'❄️', 'Natureza':'🌿',
}

export const ELEMENT_COLOR: Record<Element, string> = {
  'Fogo':'text-red-400',   'Água':'text-blue-400',   'Terra':'text-yellow-700',
  'Ar':'text-cyan-300',    'Luz':'text-yellow-300',  'Sombra':'text-purple-400',
  'Gelo':'text-sky-300',   'Natureza':'text-green-400',
}

export function randomElement(): Element {
  return ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
}

// Tempo de incubação do PRIMEIRO ovo (1 minuto)
export const FIRST_EGG_SECONDS = 60

export const EGG_DB: EggDefinition[] = [
  { type:'Comum',    color:'#6b7280', borderColor:'#9ca3af', possiblePets: range(1,50),   incubationSeconds: 3600,   label:'Ovo Comum',    xpOnDuplicate: 50   },
  { type:'Incomum',  color:'#16a34a', borderColor:'#4ade80', possiblePets: range(51,70),  incubationSeconds: 21600,  label:'Ovo Incomum',  xpOnDuplicate: 200  },
  { type:'Raro',     color:'#1d4ed8', borderColor:'#60a5fa', possiblePets: range(71,85),  incubationSeconds: 43200,  label:'Ovo Raro',     xpOnDuplicate: 500  },
  { type:'Épico',    color:'#7c3aed', borderColor:'#c084fc', possiblePets: range(86,95),  incubationSeconds: 86400,  label:'Ovo Épico',    xpOnDuplicate: 1500 },
  { type:'Lendário', color:'#d97706', borderColor:'#fcd34d', possiblePets: range(96,100), incubationSeconds: 172800, label:'Ovo Lendário', xpOnDuplicate: 5000 },
]

// Requisito de XP por nível (acumulado)
export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : Math.floor(100 * Math.pow(1.6, level - 2))
}

export function xpToNextLevel(level: number): number {
  return xpForLevel(level + 1) - xpForLevel(level)
}

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

// Recompensas da cápsula
export type CapsuleRewardType = 'egg' | 'xp_boost'
export interface CapsuleReward {
  type: CapsuleRewardType
  rarity?: Rarity       // se for ovo
  xpAmount?: number     // se for xp_boost
  label: string
  emoji: string
}

export const CAPSULE_COST = 500

// Custo com desconto VIP (tier 0 = sem VIP)
export function capsuleCostForTier(tier: number): number {
  if (tier >= 3) return 300
  if (tier === 2) return 350
  if (tier === 1) return 400
  return 500
}

export function rollCapsule(vipTier = 0): CapsuleReward {
  const r = Math.random()
  // VIP3: melhores odds — chances de ovo raros dobradas, XP baixo reduzido
  if (vipTier >= 3) {
    if (r < 0.20) return { type:'xp_boost', xpAmount:50,   label:'+50 XP',   emoji:'⭐' }
    if (r < 0.38) return { type:'xp_boost', xpAmount:200,  label:'+200 XP',  emoji:'🌟' }
    if (r < 0.50) return { type:'xp_boost', xpAmount:500,  label:'+500 XP',  emoji:'💫' }
    if (r < 0.65) return { type:'egg', rarity:'Comum',    label:'Ovo Comum',    emoji:'🥚' }
    if (r < 0.82) return { type:'egg', rarity:'Incomum',  label:'Ovo Incomum',  emoji:'🟢' }
    if (r < 0.93) return { type:'egg', rarity:'Raro',     label:'Ovo Raro',     emoji:'🔵' }
    if (r < 0.985)return { type:'egg', rarity:'Épico',    label:'Ovo Épico!',   emoji:'🟣' }
    return            { type:'egg', rarity:'Lendário', label:'🌟 OVO LENDÁRIO!', emoji:'🌟' }
  }
  // VIP2: odds levemente melhoradas
  if (vipTier === 2) {
    if (r < 0.28) return { type:'xp_boost', xpAmount:50,   label:'+50 XP',   emoji:'⭐' }
    if (r < 0.46) return { type:'xp_boost', xpAmount:200,  label:'+200 XP',  emoji:'🌟' }
    if (r < 0.57) return { type:'xp_boost', xpAmount:500,  label:'+500 XP',  emoji:'💫' }
    if (r < 0.73) return { type:'egg', rarity:'Comum',    label:'Ovo Comum',    emoji:'🥚' }
    if (r < 0.87) return { type:'egg', rarity:'Incomum',  label:'Ovo Incomum',  emoji:'🟢' }
    if (r < 0.96) return { type:'egg', rarity:'Raro',     label:'Ovo Raro',     emoji:'🔵' }
    if (r < 0.993)return { type:'egg', rarity:'Épico',    label:'Ovo Épico!',   emoji:'🟣' }
    return            { type:'egg', rarity:'Lendário', label:'🌟 OVO LENDÁRIO!', emoji:'🌟' }
  }
  // Padrão (VIP1 e sem VIP)
  if (r < 0.35) return { type:'xp_boost', xpAmount:50,   label:'+50 XP',   emoji:'⭐' }
  if (r < 0.55) return { type:'xp_boost', xpAmount:200,  label:'+200 XP',  emoji:'🌟' }
  if (r < 0.65) return { type:'xp_boost', xpAmount:500,  label:'+500 XP',  emoji:'💫' }
  if (r < 0.82) return { type:'egg', rarity:'Comum',    label:'Ovo Comum',    emoji:'🥚' }
  if (r < 0.93) return { type:'egg', rarity:'Incomum',  label:'Ovo Incomum',  emoji:'🟢' }
  if (r < 0.98) return { type:'egg', rarity:'Raro',     label:'Ovo Raro',     emoji:'🔵' }
  if (r < 0.995)return { type:'egg', rarity:'Épico',    label:'Ovo Épico!',   emoji:'🟣' }
  return            { type:'egg', rarity:'Lendário', label:'🌟 OVO LENDÁRIO!', emoji:'🌟' }
}
