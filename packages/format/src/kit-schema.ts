// ─── UI Kit Schema ──────────────────────────────────────────────
//
// Types for kit.json metadata files and the kit registry.
// These complement the .design format (schema.ts) which defines
// the actual component node trees.

// ─── Kit component descriptor ──────────────────────────────────

export interface KitComponent {
  id: string
  name: string
  file: string
  variants?: string[]
  sizes?: string[]
  description: string
  tags: string[]
  usageContext: string[]
}

// ─── Kit style metadata ────────────────────────────────────────

export type KitAesthetic =
  | 'modern-minimal'
  | 'modern-bold'
  | 'premium-glow'
  | 'clean-data'
  | 'playful'
  | 'brutalist'
  | 'corporate'

export type KitDensity = 'compact' | 'comfortable' | 'spacious'
export type KitColorScheme = 'neutral' | 'vibrant' | 'monochrome' | 'pastel'
export type KitRadius = 'none' | 'small' | 'medium' | 'large' | 'full'

export interface KitStyle {
  aesthetic: KitAesthetic | string
  radius: KitRadius
  density: KitDensity
  colorScheme: KitColorScheme
}

// ─── Kit compatibility ─────────────────────────────────────────

export interface KitCompatibility {
  frameworks: string[]
  exportFormats: string[]
}

// ─── Kit stats ─────────────────────────────────────────────────

export interface KitStats {
  componentCount: number
  variantCount: number
  downloads: number
  rating: number
}

// ─── Kit category ──────────────────────────────────────────────

export type KitCategory = 'general' | 'dashboard' | 'landing' | 'mobile' | 'effects'

// ─── Kit metadata (kit.json) ───────────────────────────────────

export interface KitMeta {
  name: string
  displayName: string
  description: string
  version: string
  author: string
  license: string
  category: KitCategory | string
  tags: string[]
  style: KitStyle
  compatibility: KitCompatibility
  components: KitComponent[]
  tokens: string
  preview: string
  stats: KitStats
}

// ─── Kit token ─────────────────────────────────────────────────

export interface KitToken {
  type: 'color' | 'number' | 'string' | 'boolean'
  value: string | number | boolean
  description?: string
}

export type KitTokens = Record<string, KitToken>

// ─── Registry ──────────────────────────────────────────────────

export interface RegistryEntry {
  name: string
  path: string
  category: KitCategory | string
  version: string
}

export interface KitRegistry {
  version: string
  kits: RegistryEntry[]
}
