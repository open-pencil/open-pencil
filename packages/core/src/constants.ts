import type { Color } from './types'

export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 }
export const DEFAULT_SHADOW_COLOR: Color = { r: 0, g: 0, b: 0, a: 0.25 }
export const SELECTION_COLOR = { r: 0.23, g: 0.51, b: 0.96, a: 1 } satisfies Color
export const COMPONENT_COLOR = { r: 0.592, g: 0.278, b: 1, a: 1 } satisfies Color
export const SNAP_COLOR = { r: 1.0, g: 0.0, b: 0.56, a: 1 } satisfies Color
export const CANVAS_BG_COLOR = { r: 0.96, g: 0.96, b: 0.96, a: 1 } satisfies Color

export const ROTATION_HANDLE_OFFSET = 20
export const SNAP_THRESHOLD = 5

export const RULER_SIZE = 20
export const RULER_BG_COLOR = { r: 0.14, g: 0.14, b: 0.14, a: 1 } satisfies Color
export const RULER_TICK_COLOR = { r: 0.4, g: 0.4, b: 0.4, a: 1 } satisfies Color
export const RULER_TEXT_COLOR = { r: 0.55, g: 0.55, b: 0.55, a: 1 } satisfies Color
export const RULER_BADGE_HEIGHT = 14
export const RULER_BADGE_PADDING = 3
export const RULER_BADGE_RADIUS = 2
export const RULER_BADGE_EXCLUSION = 30
export const RULER_TEXT_BASELINE = 0.65
export const RULER_MAJOR_TICK = 0.5
export const RULER_MINOR_TICK = 0.25
export const RULER_HIGHLIGHT_ALPHA = 0.3

export const PEN_HANDLE_RADIUS = 3
export const PEN_VERTEX_RADIUS = 4
export const PEN_CLOSE_RADIUS_BOOST = 2
export const PEN_PATH_STROKE_WIDTH = 2
export const PARENT_OUTLINE_ALPHA = 0.5
export const PARENT_OUTLINE_DASH = 4
export const DEFAULT_FONT_FAMILY = 'Inter'
export const DEFAULT_FONT_SIZE = 14
export const DEFAULT_STROKE_MITER_LIMIT = 4
export const LABEL_FONT_SIZE = 11
export const SIZE_FONT_SIZE = 10

export const ROTATION_HANDLE_RADIUS = 4

export const HANDLE_HALF_SIZE = 3

export const LABEL_OFFSET_Y = 8
export const SIZE_PILL_PADDING_X = 6
export const SIZE_PILL_PADDING_Y = 6
export const SIZE_PILL_HEIGHT = 18
export const SIZE_PILL_RADIUS = 4
export const SIZE_PILL_TEXT_OFFSET_Y = 13

export const MARQUEE_FILL_ALPHA = 0.08
export const SELECTION_DASH_ALPHA = 0.6
export const DROP_HIGHLIGHT_ALPHA = 0.8
export const DROP_HIGHLIGHT_STROKE = 2

export const LAYOUT_INDICATOR_STROKE = 2

export const SECTION_CORNER_RADIUS = 5
export const SECTION_TITLE_HEIGHT = 24
export const SECTION_TITLE_PADDING_X = 8
export const SECTION_TITLE_RADIUS = 5
export const SECTION_TITLE_FONT_SIZE = 12
export const SECTION_TITLE_GAP = 6

export const COMPONENT_SET_DASH = 6
export const COMPONENT_SET_DASH_GAP = 4
export const COMPONENT_SET_BORDER_WIDTH = 1.5
export const COMPONENT_LABEL_FONT_SIZE = 11
export const COMPONENT_LABEL_GAP = 6
export const COMPONENT_LABEL_ICON_SIZE = 10
export const COMPONENT_LABEL_ICON_GAP = 4

export const RULER_TARGET_PIXEL_SPACING = 100
export const RULER_MAJOR_TOLERANCE = 0.01

export const FLASH_COLOR = SELECTION_COLOR
export const FLASH_ATTACK_MS = 200
export const FLASH_HOLD_MS = 400
export const FLASH_RELEASE_MS = 300
export const FLASH_STROKE_WIDTH = 2
export const FLASH_PADDING = 5
export const FLASH_OVERSHOOT = 30
export const FLASH_RADIUS = 4

export const TEXT_SELECTION_COLOR = { r: 0.26, g: 0.52, b: 0.96, a: 0.3 }
export const TEXT_CARET_COLOR = BLACK
export const TEXT_CARET_WIDTH = 1

export interface ModelOption {
  id: string
  name: string
  provider: string
  tag?: string
}

export const AI_MODELS: ModelOption[] = [
  // Best for design: vision + frontend + tool calling (WebDev Arena #1, DesignBench, SWE-bench 79.6%)
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tag: 'Best for design'
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tag: 'Smartest'
  },
  // 76.8% SWE-bench, vision + UI-to-code specialist
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', provider: 'Moonshot', tag: 'Vision + code' },
  // 1M context, multimodal (text+image+audio+video), 78% SWE-bench
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'Google',
    tag: '1M context'
  },
  // 80% SWE-bench, 400K context, agentic coding
  { id: 'openai/gpt-5.3-codex', name: 'GPT-5.3 Codex', provider: 'OpenAI' },

  // Fast & cheap
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', tag: 'Fast' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', tag: 'Cheap' },
  { id: 'qwen/qwen3.5-flash-02-23', name: 'Qwen 3.5 Flash', provider: 'Qwen', tag: 'Cheap' },

  // Free (with tool calling)
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', provider: 'Qwen', tag: 'Free' },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', provider: 'OpenAI', tag: 'Free' }
]

export const DEFAULT_AI_MODEL = AI_MODELS[0].id

export const GOOGLE_FONTS_API_KEY = 'AIzaSyD1tYDR_dUEiV-Tw1vksEhZbUytgKW5pc8'

export const CJK_FALLBACK_FAMILIES_MACOS = [
  'PingFang SC',
  'Hiragino Sans',
  'Apple SD Gothic Neo',
  'Heiti SC'
]

export const CJK_FALLBACK_FAMILIES_WINDOWS = [
  'Microsoft YaHei',
  'Microsoft JhengHei',
  'Yu Gothic',
  'Malgun Gothic',
  'SimHei'
]

export const CJK_FALLBACK_FAMILIES_LINUX = [
  'Noto Sans CJK SC',
  'Noto Sans CJK JP',
  'Noto Sans CJK KR',
  'WenQuanYi Micro Hei',
  'Droid Sans Fallback'
]

export const CJK_GOOGLE_FONT = 'Noto Sans SC'
