import {
  CJK_FALLBACK_FAMILIES_LINUX,
  CJK_FALLBACK_FAMILIES_MACOS,
  CJK_FALLBACK_FAMILIES_WINDOWS,
  CJK_GOOGLE_FONTS
} from '#core/constants'

export type FontFallbackScript = 'cjk' | 'cjk-sc' | 'cjk-tc' | 'cjk-jp' | 'cjk-kr' | 'arabic'

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

function platformCJKFamilies(
  userAgent: string | undefined,
  families: Record<'mac' | 'windows' | 'linux', string[]>
): string[] {
  if (!userAgent) return families.linux
  if (userAgent.includes('Mac')) return families.mac
  if (userAgent.includes('Windows')) return families.windows
  return families.linux
}

function cjkScriptLocalFallbackFamilies(
  script: Extract<FontFallbackScript, 'cjk-sc' | 'cjk-tc' | 'cjk-jp' | 'cjk-kr'>,
  userAgent?: string
): string[] {
  switch (script) {
    case 'cjk-tc':
      return platformCJKFamilies(userAgent, {
        mac: ['PingFang TC', 'Heiti TC', 'PingFang SC', 'Hiragino Sans'],
        windows: ['Microsoft JhengHei', 'Microsoft YaHei', 'Microsoft YaHei UI', 'SimSun'],
        linux: ['Noto Sans CJK TC', 'Noto Sans CJK SC', 'Droid Sans Fallback']
      })
    case 'cjk-jp':
      return platformCJKFamilies(userAgent, {
        mac: ['Hiragino Sans', 'PingFang SC', 'PingFang TC'],
        windows: ['Yu Gothic', 'Microsoft YaHei', 'Microsoft JhengHei'],
        linux: ['Noto Sans CJK JP', 'Noto Sans CJK SC', 'Droid Sans Fallback']
      })
    case 'cjk-kr':
      return platformCJKFamilies(userAgent, {
        mac: ['Apple SD Gothic Neo', 'PingFang SC', 'Hiragino Sans'],
        windows: ['Malgun Gothic', 'Microsoft YaHei', 'Yu Gothic'],
        linux: ['Noto Sans CJK KR', 'Noto Sans CJK SC', 'Droid Sans Fallback']
      })
    default:
      return platformCJKFamilies(userAgent, {
        mac: ['PingFang SC', 'Heiti SC', 'PingFang TC', 'Hiragino Sans'],
        windows: ['Microsoft YaHei', 'Microsoft YaHei UI', 'SimHei', 'SimSun'],
        linux: ['Noto Sans CJK SC', 'WenQuanYi Micro Hei', 'Droid Sans Fallback']
      })
  }
}

const CJK_SCRIPT_REMOTE_FAMILIES: Record<
  Extract<FontFallbackScript, 'cjk-sc' | 'cjk-tc' | 'cjk-jp' | 'cjk-kr'>,
  string[]
> = {
  'cjk-sc': ['Noto Sans SC'],
  'cjk-tc': ['Noto Sans TC', 'Noto Sans SC'],
  'cjk-jp': ['Noto Sans JP', 'Noto Sans SC'],
  'cjk-kr': ['Noto Sans KR', 'Noto Sans SC']
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
    'cjk-sc': {
      script: 'cjk-sc',
      localFamilies: cjkScriptLocalFallbackFamilies('cjk-sc', userAgent),
      remoteFamilies: CJK_SCRIPT_REMOTE_FAMILIES['cjk-sc']
    },
    'cjk-tc': {
      script: 'cjk-tc',
      localFamilies: cjkScriptLocalFallbackFamilies('cjk-tc', userAgent),
      remoteFamilies: CJK_SCRIPT_REMOTE_FAMILIES['cjk-tc']
    },
    'cjk-jp': {
      script: 'cjk-jp',
      localFamilies: cjkScriptLocalFallbackFamilies('cjk-jp', userAgent),
      remoteFamilies: CJK_SCRIPT_REMOTE_FAMILIES['cjk-jp']
    },
    'cjk-kr': {
      script: 'cjk-kr',
      localFamilies: cjkScriptLocalFallbackFamilies('cjk-kr', userAgent),
      remoteFamilies: CJK_SCRIPT_REMOTE_FAMILIES['cjk-kr']
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
