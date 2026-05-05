import {
  CJK_FALLBACK_FAMILIES_LINUX,
  CJK_FALLBACK_FAMILIES_MACOS,
  CJK_FALLBACK_FAMILIES_WINDOWS,
  CJK_GOOGLE_FONTS
} from '#core/constants'

export type FontFallbackScript = 'cjk' | 'arabic'

export interface FontFallbackManifestEntry {
  script: FontFallbackScript
  localFamilies: string[]
  remoteFamilies: string[]
}

export const ARABIC_LOCAL_FALLBACK_FAMILIES = [
  'Noto Naskh Arabic',
  'Noto Sans Arabic',
  'Geeza Pro',
  'Arial',
  'Tahoma',
  'Amiri'
]

export const ARABIC_REMOTE_FALLBACK_FAMILIES = ['Noto Naskh Arabic', 'Noto Sans Arabic']

export function cjkLocalFallbackFamilies(userAgent?: string): string[] {
  if (!userAgent) return [...CJK_FALLBACK_FAMILIES_LINUX]
  if (userAgent.includes('Mac')) return [...CJK_FALLBACK_FAMILIES_MACOS]
  if (userAgent.includes('Windows')) return [...CJK_FALLBACK_FAMILIES_WINDOWS]
  return [...CJK_FALLBACK_FAMILIES_LINUX]
}

export function fontFallbackManifest(
  userAgent?: string
): Record<FontFallbackScript, FontFallbackManifestEntry> {
  return {
    cjk: {
      script: 'cjk',
      localFamilies: cjkLocalFallbackFamilies(userAgent),
      remoteFamilies: [...CJK_GOOGLE_FONTS]
    },
    arabic: {
      script: 'arabic',
      localFamilies: [...ARABIC_LOCAL_FALLBACK_FAMILIES],
      remoteFamilies: [...ARABIC_REMOTE_FALLBACK_FAMILIES]
    }
  }
}

export function fontFallbackEntry(
  script: FontFallbackScript,
  userAgent?: string
): FontFallbackManifestEntry {
  return fontFallbackManifest(userAgent)[script]
}
