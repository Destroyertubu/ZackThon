export const GARDEN_RECIPE_STORAGE_KEY = 'wanderwise-garden-recipes-v1'

export const KNOWLEDGE_INGREDIENTS = [
  { id: 'literature', name: '文学', color: '#e9bd6b', note: '意象 · 叙事', method: '写一段不超过 120 字的短文' },
  { id: 'photography', name: '摄影', color: '#88c7ed', note: '光线 · 构图', method: '为三张照片写出镜头与光线安排' },
  { id: 'philosophy', name: '哲思', color: '#bb9fe8', note: '追问 · 视角', method: '提出一个问题，再写出两种相反的回答' },
  { id: 'nature', name: '自然', color: '#9dc49c', note: '生长 · 观察', method: '观察一种植物，记录三个具体细节' },
  { id: 'music', name: '音乐', color: '#e5a297', note: '节奏 · 共鸣', method: '把一个场景分成三个节拍，并为每拍选一种声音' },
] as const

export type KnowledgeId = typeof KNOWLEDGE_INGREDIENTS[number]['id']
export interface ThoughtRecipe {
  id: string
  first: KnowledgeId
  second: KnowledgeId
  firstPercent: number
  name: string
  prompt: string
}

const pairIdeas: Record<string, { name: string; prompt: string }> = {
  'literature+photography': { name: '落日大道', prompt: '沿一条熟悉的街寻找三处落日光影，把它们分别写成故事的开场、转折与结尾。' },
  'literature+philosophy': { name: '未寄出的答案', prompt: '让“昨天的自己”和“明天的自己”交换一封信，讨论同一个选择，保留他们无法同意的地方。' },
  'literature+nature': { name: '苔藓来信', prompt: '以窗边一株植物的口吻，讲述它见过的人类匆忙；用叶片、光照与季节代替时间刻度。' },
  'literature+music': { name: '月光行板', prompt: '写一段夜归的场景，让长句像步行、短句像心跳，并为结尾留出一次停顿。' },
  'photography+philosophy': { name: '镜外之问', prompt: '为同一个物体设计两种相反的构图：一种让它显得自由，一种让它显得受困，解释镜头省略了什么。' },
  'photography+nature': { name: '露光标本', prompt: '在一平方米内寻找三种微小纹理，用远景、近景与微距组成一段关于生长的视觉叙事。' },
  'photography+music': { name: '蓝调快门', prompt: '把一段喜欢的音乐分成开场、高潮与尾声，为每一段安排一张照片的光线、色温和运动。' },
  'philosophy+nature': { name: '树的时间', prompt: '观察树上新叶与旧枝，分别用它们解释“改变”与“延续”，再找出这个比喻失效的地方。' },
  'philosophy+music': { name: '回声悖论', prompt: '想象一段旋律每次重复都会改变一个音：写下它从什么时候开始不再是原来的旋律，以及你的判断理由。' },
  'nature+music': { name: '林间慢拍', prompt: '听见风、叶片和脚步后，为三种声音各画一条节奏线，让它们组成一段由稀疏到丰盛的森林序曲。' },
}

export function getKnowledgeIngredient(id: KnowledgeId) {
  return KNOWLEDGE_INGREDIENTS.find(ingredient => ingredient.id === id)!
}

export function mixThoughtRecipe(first: KnowledgeId, second: KnowledgeId, firstPercent: number): ThoughtRecipe {
  const a = KNOWLEDGE_INGREDIENTS.findIndex(item => item.id === first)
  const b = KNOWLEDGE_INGREDIENTS.findIndex(item => item.id === second)
  if (a < 0 || b < 0 || first === second) throw new Error('请选择两种不同的知识成分')
  const percent = Number.isFinite(firstPercent) ? Math.max(10, Math.min(90, Math.round(firstPercent / 10) * 10)) : 50
  const pair = a < b ? `${first}+${second}` : `${second}+${first}`
  const idea = pairIdeas[pair]
  const leading = getKnowledgeIngredient(percent >= 50 ? first : second)
  const ending = percent === 50 ? '让两种表达各占一半，先观察，再把发现变成作品。' : `以${leading.name}为主线：${leading.method}，再让另一种成分改变其中一个细节。`
  return {
    id: `${pair}:${a < b ? percent : 100 - percent}`,
    first, second, firstPercent: percent, name: idea.name,
    prompt: `${idea.prompt}${ending}`,
  }
}

/** Store only ingredient choices; names and prompts always come from the current recipe catalog. */
export function readGardenRecipes(): ThoughtRecipe[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(GARDEN_RECIPE_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const recipes = new Map<string, ThoughtRecipe>()
    for (const value of parsed.slice(0, 12)) {
      if (!value || typeof value !== 'object') continue
      const { first, second, firstPercent } = value
      if (!KNOWLEDGE_INGREDIENTS.some(item => item.id === first) || !KNOWLEDGE_INGREDIENTS.some(item => item.id === second)
        || first === second || typeof firstPercent !== 'number' || !Number.isFinite(firstPercent)) continue
      const recipe = mixThoughtRecipe(first, second, firstPercent)
      recipes.set(recipe.id, recipe)
    }
    return [...recipes.values()]
  } catch { return [] }
}

export function writeGardenRecipes(recipes: ThoughtRecipe[]): boolean {
  try {
    localStorage.setItem(GARDEN_RECIPE_STORAGE_KEY, JSON.stringify(recipes.slice(0, 12).map(({ first, second, firstPercent }) => ({ first, second, firstPercent }))))
    return true
  } catch { return false }
}
