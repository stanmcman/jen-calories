// Calorie estimates from Claude, called straight from the phone with Jen's own API key.
import Anthropic from '@anthropic-ai/sdk'
import { getKV, setKV } from '../db'

export const AI_MODEL = 'claude-sonnet-5-5'
const KEY = 'anthropicKey'

export async function getApiKey() {
  return (await getKV<string>(KEY)) || ''
}
export async function setApiKey(k: string) {
  await setKV(KEY, k.trim())
}

function client(apiKey: string) {
  return new Anthropic({
    apiKey,
    // This app has no server: the key lives only on Jen's phone and is sent only to Anthropic.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
    timeout: 90_000,
  })
}

// ---------- Result shapes ----------

export type Confidence = 'low' | 'medium' | 'high'

export interface FoodItem {
  name: string
  amount: string
  calories: number
}

export interface FoodEstimate {
  is_food: boolean
  description: string
  items: FoodItem[]
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: Confidence
  note: string
}

export interface RecipeEstimate {
  name: string
  ingredients: FoodItem[]
  total_calories: number
  note: string
}

const itemSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    amount: { type: 'string', description: 'Portion, e.g. "1 cup", "2 large", "about 4 oz"' },
    calories: { type: 'integer' },
  },
  required: ['name', 'amount', 'calories'],
  additionalProperties: false,
}

const foodSchema = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean', description: 'false if there is no food or drink to estimate' },
    description: { type: 'string', description: 'Short log entry, e.g. "Turkey and avocado sandwich on sourdough"' },
    items: { type: 'array', items: itemSchema },
    calories: { type: 'integer', description: 'Total calories for everything eaten' },
    protein_g: { type: 'integer' },
    carbs_g: { type: 'integer' },
    fat_g: { type: 'integer' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    note: { type: 'string', description: 'One short sentence on key assumptions (portion size, cooking method). Empty if none.' },
  },
  required: ['is_food', 'description', 'items', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'confidence', 'note'],
  additionalProperties: false,
}

const recipeSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'A short name for the recipe' },
    ingredients: { type: 'array', items: itemSchema },
    total_calories: { type: 'integer', description: 'Calories for the whole recipe (all servings)' },
    note: { type: 'string', description: 'One short sentence on assumptions. Empty if none.' },
  },
  required: ['name', 'ingredients', 'total_calories', 'note'],
  additionalProperties: false,
}

const FOOD_SYSTEM = `You estimate calories for a personal food diary.
Use typical US portion sizes unless the person or the photo shows otherwise. If an amount is unclear, assume a normal single serving and say so in the note.
Count everything that will be eaten: cooking oil, butter, dressings, sauces, and drinks if shown or mentioned.
In a photo, judge portion size from plates, utensils and hands. If text accompanies a photo, it overrides what you see (e.g. "I ate half").
Set confidence honestly: "high" for packaged foods or precise amounts, "medium" for typical home or restaurant meals, "low" when portions or ingredients are a guess.
Keep the description short and natural, like a diary line. Round calories to the nearest 5.
If there is no food or drink, set is_food to false and use 0 for the numbers.`

const RECIPE_SYSTEM = `You estimate calories for a home recipe for a personal food diary.
List each ingredient with its amount as given and its calories. Use standard USDA-style values. Count oils and butter used in cooking.
If an amount is missing, assume a typical amount for that recipe and mention it in the note. Round calories to the nearest 5.`

// ---------- Calls ----------

type Content = Anthropic.Beta.Messages.BetaContentBlockParam[]

async function run<T>(apiKey: string, system: string, content: Content, schema: object, effort: 'low' | 'medium'): Promise<T> {
  if (!navigator.onLine) throw new AIError('offline')
  const res = await client(apiKey).beta.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    // If Claude declines, Anthropic retries on a suitable fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    output_config: { effort, format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    messages: [{ role: 'user', content }],
  })
  if (res.stop_reason === 'refusal') throw new AIError('refused')
  if (res.stop_reason === 'max_tokens') throw new AIError('unclear')
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AIError('unclear')
  }
}

export async function estimateFromText(apiKey: string, text: string) {
  const r = await run<FoodEstimate>(
    apiKey,
    FOOD_SYSTEM,
    [{ type: 'text', text: `What I ate: ${text}` }],
    foodSchema,
    'low',
  )
  if (!r.is_food) throw new AIError('not-food')
  return r
}

export async function estimateFromPhoto(apiKey: string, jpegBase64: string, note: string) {
  const r = await run<FoodEstimate>(
    apiKey,
    FOOD_SYSTEM,
    [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
      { type: 'text', text: note.trim() ? `Estimate what's in this photo. My note: ${note.trim()}` : "Estimate what's in this photo." },
    ],
    foodSchema,
    'medium',
  )
  if (!r.is_food) throw new AIError('not-food')
  return r
}

export async function estimateRecipe(apiKey: string, recipe: string) {
  return run<RecipeEstimate>(apiKey, RECIPE_SYSTEM, [{ type: 'text', text: recipe }], recipeSchema, 'medium')
}

/** Cheapest possible call, to check the key works. */
export async function testKey(apiKey: string) {
  if (!navigator.onLine) throw new AIError('offline')
  await client(apiKey).messages.create({
    model: AI_MODEL,
    max_tokens: 16,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Reply with OK.' }],
  })
}

// ---------- Friendly errors ----------

export type AIErrorKind = 'offline' | 'auth' | 'billing' | 'busy' | 'network' | 'refused' | 'unclear' | 'not-food' | 'other'

export class AIError extends Error {
  kind: AIErrorKind
  constructor(kind: AIErrorKind) {
    super(kind)
    this.kind = kind
  }
}

export function explain(err: unknown): { kind: AIErrorKind; message: string } {
  let kind: AIErrorKind = 'other'
  if (err instanceof AIError) kind = err.kind
  else if (err instanceof Anthropic.AuthenticationError) kind = 'auth'
  else if (err instanceof Anthropic.PermissionDeniedError) kind = 'billing'
  else if (err instanceof Anthropic.RateLimitError) kind = 'busy'
  else if (err instanceof Anthropic.InternalServerError) kind = 'busy'
  else if (err instanceof Anthropic.APIConnectionError) kind = navigator.onLine ? 'network' : 'offline'
  else if (err instanceof Anthropic.BadRequestError && /credit|billing|balance/i.test(err.message)) kind = 'billing'
  const message: Record<AIErrorKind, string> = {
    offline: "You're offline. Enter the calories yourself for now, or try again when you have a connection.",
    auth: "The API key wasn't accepted. Check it in More → AI estimates.",
    billing: 'Your Anthropic account needs credit or a payment method. Check console.anthropic.com.',
    busy: 'The AI service is busy. Try again in a moment.',
    network: "Couldn't reach the AI service. Check your connection and try again.",
    refused: "The AI couldn't help with this one. Enter the calories yourself.",
    unclear: "Couldn't make out an estimate. Try a clearer photo or add a short description.",
    'not-food': "That doesn't look like food. Try another photo or describe what you ate.",
    other: 'Something went wrong getting an estimate. You can enter the calories yourself.',
  }
  return { kind, message: message[kind] }
}

// ---------- Photos ----------

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

function resize(img: HTMLImageElement, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not compress image'))), 'image/jpeg', quality),
  )
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** One copy sized for the AI (~1024px) and a small one to keep with the entry (~640px). */
export async function preparePhoto(file: Blob) {
  const img = await loadImage(file)
  const [forAI, thumb] = await Promise.all([resize(img, 1024, 0.82), resize(img, 640, 0.72)])
  return { base64: await toBase64(forAI), thumb }
}
