import { GOOGLE_FONTS_API_KEY, IS_BROWSER } from '@open-pencil/core'

export interface GoogleFontEntry {
  family: string
  variants: string[]
  subsets: string[]
  category: string // 'sans-serif', 'serif', 'display', 'monospace', 'handwriting'
}

let catalogPromise: Promise<GoogleFontEntry[]> | null = null
let catalogCache: GoogleFontEntry[] | null = null

const DB_NAME = 'open-pencil-fonts'
const DB_VERSION = 1
const STORE_NAME = 'google-fonts'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
  })
}

async function dbGet(key: string): Promise<Uint8Array | null> {
  if (!IS_BROWSER) return null
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function dbSet(key: string, value: Uint8Array): Promise<void> {
  if (!IS_BROWSER) return
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(value, key)
  } catch (e) {
    console.warn('Google font cache write failed:', e)
  }
}

export async function getGoogleFontCatalog(): Promise<GoogleFontEntry[]> {
  if (catalogCache) return catalogCache
  if (catalogPromise) return catalogPromise

  catalogPromise = (async () => {
    const cachedJson = IS_BROWSER ? localStorage.getItem('op:google-fonts-catalog') : null
    const cachedAt = IS_BROWSER ? localStorage.getItem('op:google-fonts-catalog-at') : null
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

    if (cachedJson && cachedAt && Date.now() - Number(cachedAt) < SEVEN_DAYS) {
      try {
        const parsed = JSON.parse(cachedJson) as GoogleFontEntry[]
        catalogCache = parsed
        return parsed
      } catch (e) {
        console.warn('Google font catalog cache parse failed:', e)
      }
    }

    const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Google Fonts API error: ${res.status}`)
    const data = (await res.json()) as { items: GoogleFontEntry[] }
    const items = data.items

    if (IS_BROWSER) {
      localStorage.setItem('op:google-fonts-catalog', JSON.stringify(items))
      localStorage.setItem('op:google-fonts-catalog-at', String(Date.now()))
    }

    catalogCache = items
    return items
  })()

  return catalogPromise
}

const styleToVariant = (style: string): string => {
  const s = style.toLowerCase().replace(/[\s-_]/g, '')
  const italic = s.includes('italic')
  const weightMatch = s.match(
    /(thin|hairline|extralight|ultralight|light|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|\d{3})/
  )
  const weightMap: Record<string, string> = {
    thin: '100',
    hairline: '100',
    extralight: '200',
    ultralight: '200',
    light: '300',
    medium: '500',
    semibold: '600',
    demibold: '600',
    bold: '700',
    extrabold: '800',
    ultrabold: '800',
    black: '900',
    heavy: '900'
  }
  let weight = '400'
  if (weightMatch) {
    const mapped = weightMap[weightMatch[1]]
    weight = mapped ? mapped : weightMatch[1]
  }
  if (weight === '400' && !italic) return 'regular'
  if (weight === '400' && italic) return 'italic'
  return italic ? `${weight}italic` : weight
}

export async function downloadGoogleFont(
  family: string,
  style = 'Regular'
): Promise<Uint8Array | null> {
  if (!IS_BROWSER) return null

  const variant = styleToVariant(style)
  const cacheKey = `gf:${family}|${variant}`

  const cached = await dbGet(cacheKey)
  if (cached) return cached

  const catalog = await getGoogleFontCatalog()
  const entry = catalog.find((f) => f.family === family)
  if (!entry) return null

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${variant.replace('italic', '')}`
  const cssRes = await fetch(cssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  if (!cssRes.ok) return null

  const css = await cssRes.text()
  const urlMatch = css.match(/url\((https:\/\/[^)]+\.woff2)\)/)
  if (!urlMatch) return null

  const woff2Res = await fetch(urlMatch[1])
  if (!woff2Res.ok) return null

  const arrayBuffer = await woff2Res.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  await dbSet(cacheKey, bytes)
  return bytes
}

export async function loadGoogleFont(family: string, style = 'Regular'): Promise<boolean> {
  const bytes = await downloadGoogleFont(family, style)
  if (!bytes) return false

  const weight = styleToWeight(style)
  const italic = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
  const face = new FontFace(family, bytes.buffer as ArrayBuffer, {
    weight: String(weight),
    style: italic
  })
  await face.load()
  document.fonts.add(face)
  return true
}

function styleToWeight(style: string): number {
  const s = style.toLowerCase().replace(/[\s-_]/g, '')
  if (s.includes('thin') || s.includes('hairline')) return 100
  if (s.includes('extralight') || s.includes('ultralight')) return 200
  if (s.includes('light')) return 300
  if (s.includes('medium')) return 500
  if (s.includes('semibold') || s.includes('demibold')) return 600
  if (s.includes('extrabold') || s.includes('ultrabold')) return 800
  if (s.includes('black') || s.includes('heavy')) return 900
  if (s.includes('bold')) return 700
  return 400
}
