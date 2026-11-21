// Free food databases: Open Food Facts (barcodes, no key) and USDA FoodData Central (search).
import { getKV, setKV } from '../db'

/** A food with nutrition per 100 g (or ml), plus any serving sizes we know about. */
export interface FoodInfo {
  name: string
  brand?: string
  kcal100: number
  protein100?: number
  carbs100?: number
  fat100?: number
  /** Ways to measure a portion, each with its weight in grams. */
  measures: { label: string; grams: number; serving?: boolean }[]
  unit: 'g' | 'ml'
  source: 'Open Food Facts' | 'USDA'
}

export class FoodLookupError extends Error {
  kind: 'offline' | 'not-found' | 'limit' | 'other'
  constructor(kind: FoodLookupError['kind']) {
    super(kind)
    this.kind = kind
  }
}

const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : undefined)

async function getJSON(url: string) {
  if (!navigator.onLine) throw new FoodLookupError('offline')
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new FoodLookupError(navigator.onLine ? 'other' : 'offline')
  }
  if (res.status === 404) throw new FoodLookupError('not-found')
  if (res.status === 429 || res.status === 403) throw new FoodLookupError('limit')
  if (!res.ok) throw new FoodLookupError('other')
  return res.json()
}

// ---------- Open Food Facts ----------

export async function lookupBarcode(code: string): Promise<FoodInfo> {
  const clean = code.replace(/\D/g, '')
  if (clean.length < 6) throw new FoodLookupError('not-found')
  const data = await getJSON(
    `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,quantity`,
  )
  const p = data?.product
  if (!data || data.status === 0 || !p) throw new FoodLookupError('not-found')
  const nm = p.nutriments ?? {}
  let kcal100 = n(nm['energy-kcal_100g'])
  if (kcal100 === undefined && n(nm['energy_100g']) !== undefined) kcal100 = n(nm['energy_100g'])! / 4.184
  const servingG = n(p.serving_quantity)
  // Some products only list nutrition per serving.
  if (kcal100 === undefined && servingG && n(nm['energy-kcal_serving']) !== undefined) {
    kcal100 = (n(nm['energy-kcal_serving'])! / servingG) * 100
  }
  if (kcal100 === undefined) throw new FoodLookupError('not-found')
  const measures: FoodInfo['measures'] = []
  if (servingG) measures.push({ label: p.serving_size ? `serving · ${p.serving_size}` : `serving · ${servingG} g`, grams: servingG, serving: true })
  return {
    name: (p.product_name_en || p.product_name || 'Unnamed product').trim(),
    brand: typeof p.brands === 'string' ? p.brands.split(',')[0].trim() || undefined : undefined,
    kcal100,
    protein100: n(nm.proteins_100g),
    carbs100: n(nm.carbohydrates_100g),
    fat100: n(nm.fat_100g),
    measures,
    unit: /ml|l\b/i.test(String(p.quantity ?? '')) && !/g\b/i.test(String(p.quantity ?? '')) ? 'ml' : 'g',
    source: 'Open Food Facts',
  }
}

// ---------- USDA FoodData Central ----------

const USDA_KEY = 'usdaKey'
export async function getUsdaKey() {
  return (await getKV<string>(USDA_KEY)) || ''
}
export async function setUsdaKey(k: string) {
  await setKV(USDA_KEY, k.trim())
}

type UsdaNutrient = { nutrientId?: number; nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number }
type UsdaFood = {
  description: string
  brandName?: string
  brandOwner?: string
  dataType?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaNutrient[]
  foodMeasures?: { disseminationText?: string; gramWeight?: number }[]
}

function nutrient(list: UsdaNutrient[] | undefined, ids: number[], numbers: string[]) {
  const hit = list?.find((x) => (x.nutrientId && ids.includes(x.nutrientId)) || (x.nutrientNumber && numbers.includes(x.nutrientNumber)))
  return hit?.value
}

/** USDA names are SHOUTY and comma-heavy; make them readable. */
function tidy(s: string) {
  const t = s.toLowerCase().replace(/\s+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export async function searchFoods(query: string): Promise<FoodInfo[]> {
  const key = (await getUsdaKey()) || 'DEMO_KEY'
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(query)}&pageSize=20&dataType=${encodeURIComponent('Survey (FNDDS),Foundation,SR Legacy,Branded')}`
  const data = await getJSON(url)
  const foods: UsdaFood[] = data?.foods ?? []
  const out: FoodInfo[] = []
  for (const f of foods) {
    // Energy in kcal: 1008 (or the Atwater variants 2047/2048 used by Foundation foods)
    let kcal = nutrient(f.foodNutrients?.filter((x) => (x.unitName ?? 'KCAL').toUpperCase() === 'KCAL'), [1008, 2047, 2048], ['208', '957', '958'])
    if (kcal === undefined) continue
    const measures: FoodInfo['measures'] = []
    const unit: 'g' | 'ml' = (f.servingSizeUnit ?? '').toLowerCase() === 'ml' ? 'ml' : 'g'
    if (f.servingSize && /^(g|grm|ml)$/i.test(f.servingSizeUnit ?? '')) {
      measures.push({
        label: `serving · ${f.householdServingFullText ? `${f.householdServingFullText}, ` : ''}${Math.round(f.servingSize)} ${unit}`,
        grams: f.servingSize,
        serving: true,
      })
    }
    for (const m of f.foodMeasures ?? []) {
      if (m.disseminationText && m.gramWeight && m.disseminationText.toLowerCase() !== 'quantity not specified' && measures.length < 6) {
        measures.push({ label: m.disseminationText, grams: m.gramWeight })
      }
    }
    kcal = Math.round(kcal)
    out.push({
      name: tidy(f.description),
      brand: f.brandName || f.brandOwner || undefined,
      kcal100: kcal,
      protein100: nutrient(f.foodNutrients, [1003], ['203']),
      carbs100: nutrient(f.foodNutrients, [1005], ['205']),
      fat100: nutrient(f.foodNutrients, [1004], ['204']),
      measures,
      unit,
      source: 'USDA',
    })
  }
  return out
}

export function lookupMessage(e: unknown) {
  const kind = e instanceof FoodLookupError ? e.kind : 'other'
  return {
    offline: "You're offline. Food lookups need an internet connection.",
    'not-found': "Couldn't find that one. Try searching by name, or enter it yourself.",
    limit: 'The free food database is busy right now. Try again later, or add your own free USDA key in More → Food databases.',
    other: "Couldn't reach the food database. Try again in a moment.",
  }[kind]
}
