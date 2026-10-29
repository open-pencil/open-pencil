import type { Fill, Stroke } from '@open-pencil/scene-graph'
import { WHITE } from '@open-pencil/scene-graph/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SelectionTheme } from '#core/canvas/renderer/types'

export * from './ai/providers'

export const IS_BROWSER = typeof window !== 'undefined'
export const IS_TAURI = IS_BROWSER && '__TAURI_INTERNALS__' in window

export const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 }
export const DEFAULT_SHADOW_COLOR: Color = { r: 0, g: 0, b: 0, a: 0.25 }
export const SELECTION_COLOR = { r: 0.23, g: 0.51, b: 0.96, a: 1 } satisfies Color
/** Selection chrome when the app sets no accent: the default blue with white text. */
export const DEFAULT_SELECTION_THEME: Readonly<SelectionTheme> = {
  color: SELECTION_COLOR,
  foreground: WHITE
}
export const COMPONENT_COLOR = { r: 0.592, g: 0.278, b: 1, a: 1 } satisfies Color
/** Slot frames and their outlines, `#f24bbc` like the app's `--color-slot`. */
export const SLOT_COLOR = { r: 0.949, g: 0.294, b: 0.737, a: 1 } satisfies Color
export const SLOT_EMPTY_FILL_ALPHA = 0.08
export const SNAP_COLOR = { r: 1.0, g: 0.0, b: 0.56, a: 1 } satisfies Color
/** Guides through path vertices and their crosses, measured from Figma's pen and vector edit mode. */
export const VERTEX_SNAP_COLOR = { r: 0.81, g: 0.3, b: 0.18, a: 1 } satisfies Color
export const VERTEX_SNAP_GUIDE_ALPHA = 0.6
export const VERTEX_SNAP_MARK_RADIUS = 2.5
export const MEASUREMENT_COLOR = { r: 0.949, g: 0.282, b: 0.133, a: 1 } satisfies Color
export const MEASUREMENT_PILL_PADDING_X = 5
export const MEASUREMENT_PILL_HEIGHT = 18
export const MEASUREMENT_PILL_RADIUS = 3
export const MEASUREMENT_TEXT_BASELINE = 4
export const CANVAS_BG_COLOR = { r: 0.96, g: 0.96, b: 0.96, a: 1 } satisfies Color
export const SNAP_THRESHOLD_SCREEN_PX = 5

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

export const PEN_HANDLE_RADIUS = 2.5
export const PEN_VERTEX_RADIUS = 3
export const PEN_ANCHOR_RADIUS = 4
export const PEN_CLOSE_RADIUS_BOOST = 2
export const PEN_PATH_STROKE_WIDTH = 2
export const PARENT_OUTLINE_ALPHA = 0.5
export const PARENT_OUTLINE_DASH = 4
export const DEFAULT_FONT_FAMILY = 'Inter'
export const DEFAULT_FONT_SIZE = 14
export const DEFAULT_STROKE_MITER_LIMIT = 4
/** Figma's stroke weight for a node that has not been given one. */
export const LABEL_FONT_SIZE = 11
export const SIZE_FONT_SIZE = 10
export const VALUE_FONT_SIZE = 11

export const HANDLE_HALF_SIZE = 3

export const LABEL_OFFSET_Y = 8
export const SIZE_PILL_PADDING_X = 6
export const SIZE_PILL_PADDING_Y = 6
export const SIZE_PILL_HEIGHT = 18
export const SIZE_PILL_RADIUS = 4
export const SIZE_PILL_TEXT_OFFSET_Y = 13

export const MARQUEE_FILL_ALPHA = 0.08
export const SELECTION_DASH_ALPHA = 0.6
/** Tint inside the layer of the code element around the cursor, under its hover outline. */
export const CODE_FOCUS_FILL_ALPHA = 0.1
export const DROP_HIGHLIGHT_ALPHA = 0.8
export const DROP_HIGHLIGHT_STROKE = 2

export const LAYOUT_INDICATOR_STROKE = 2
export const AUTO_LAYOUT_HOVER_TICK_LENGTH = 12
export const AUTO_LAYOUT_HOVER_STRIPE_GAP = 8
export const AUTO_LAYOUT_HOVER_STRIPE_WIDTH = 1
export const AUTO_LAYOUT_HOVER_STROKE_WIDTH = 1.5
/** Dash and gap, in screen pixels, of the dotted outlines around auto layout children (Figma 126). */
export const LAYOUT_OUTLINE_DASH = 1.75
export const LAYOUT_OUTLINE_GAP = 1.25
export const AUTO_LAYOUT_HOVER_VALUE_OFFSET = 18
// Measured on Figma desktop 126's padding and gap value pills.
export const AUTO_LAYOUT_HOVER_VALUE_PILL_HEIGHT = 16.5
export const AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS = 2.5
export const AUTO_LAYOUT_HOVER_VALUE_PILL_PADDING_X = 4.5
export const AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE = 12
export const AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE = 8
export const AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE = 20
export const AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X = 18
export const AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y = 36
export const AUTO_LAYOUT_HOVER_BLUE = { r: 0.28, g: 0.64, b: 1, a: 0.82 } satisfies Color
export const AUTO_LAYOUT_HOVER_BLUE_FILL = { r: 0.28, g: 0.64, b: 1, a: 0.1 } satisfies Color
export const AUTO_LAYOUT_HOVER_MAGENTA = { r: 1, g: 0.32, b: 0.68, a: 0.78 } satisfies Color
export const AUTO_LAYOUT_HOVER_MAGENTA_FILL = { r: 1, g: 0.32, b: 0.68, a: 0.1 } satisfies Color
// The value pills over a gap and a padding, sampled from Figma desktop 126.
export const AUTO_LAYOUT_HOVER_GAP_PILL = { r: 0.886, g: 0.271, b: 0.686, a: 1 } satisfies Color
export const AUTO_LAYOUT_HOVER_PADDING_PILL = { r: 0.271, g: 0.592, b: 0.973, a: 1 } satisfies Color

export const SECTION_TITLE_HEIGHT = 24
export const SECTION_TITLE_PADDING_X = 6
export const SECTION_TITLE_RADIUS = 5
export const SECTION_TITLE_FONT_SIZE = 11
/**
 * The family section titles draw in: the bundled Inter SemiBold under a name of its own, on the
 * canvas and in the page, so renaming a title shows the same glyphs and document fonts named
 * Inter cannot replace them.
 */
export const SECTION_TITLE_FONT_FAMILY = 'OpenPencil Section Title'
export const SECTION_TITLE_FONT_URL = '/Inter-SemiBold.ttf'
export const SECTION_TITLE_GAP = 6
export const SECTION_HOVER_STROKE_WIDTH = 2

export const COMPONENT_SET_DASH = 6
export const COMPONENT_SET_DASH_GAP = 4
export const COMPONENT_SET_BORDER_WIDTH = 1.5
/** Corners of the outline the editor draws around a component set with no strokes of its own. */
export const COMPONENT_SET_OUTLINE_RADIUS = 5
export const COMPONENT_LABEL_FONT_SIZE = 11
export const COMPONENT_LABEL_GAP = 6
export const COMPONENT_LABEL_ICON_SIZE = 10
export const COMPONENT_LABEL_ICON_GAP = 4

export const RULER_TARGET_PIXEL_SPACING = 100
export const RULER_MAJOR_TOLERANCE = 0.01

export const FLASH_ATTACK_MS = 200
export const FLASH_HOLD_MS = 400
export const FLASH_RELEASE_MS = 300
export const FLASH_STROKE_WIDTH = 2
export const FLASH_PADDING = 5
export const FLASH_OVERSHOOT = 30
export const FLASH_RADIUS = 4

export const ISSUE_ERROR_COLOR = { r: 0.949, g: 0.282, b: 0.133, a: 1 } satisfies Color // #F24822
export const ISSUE_WARNING_COLOR = { r: 1, g: 0.702, b: 0.078, a: 1 } satisfies Color // #FFB314
export const ISSUE_INFO_COLOR = { r: 0.55, g: 0.55, b: 0.55, a: 1 } satisfies Color
export const ISSUE_MARKER_HEIGHT = 16
export const ISSUE_MARKER_PADDING_X = 5
/** Gap between a layer's corner and its marker; clears the 8px selection handle. */
export const ISSUE_MARKER_OFFSET = 4
/** Markers closer than this merge into one. */
export const ISSUE_MARKER_GAP = 2
export const ISSUE_MARKER_VIEWPORT_INSET = 4
/** Layers smaller than this on screen pass their marker to an ancestor. */
export const ISSUE_MARKER_MIN_TARGET = 24
export const ISSUE_MARKER_MAX_COUNT = 99
/** Edge pins closer than this along the viewport edge merge into one. */
export const ISSUE_EDGE_MERGE_GAP = 24
/** Length of the chevron an edge pin points with, beyond its ring. */
export const ISSUE_EDGE_ARROW = 5
export const ISSUE_MARKER_RING_WIDTH = 1.5
export const ISSUE_HIGHLIGHT_STROKE_WIDTH = 1.5
export const ISSUE_HIGHLIGHT_FILL_ALPHA = 0.08

export const AI_ACTIVE_COLOR = { r: 0.26, g: 0.52, b: 0.96 }
export const AI_DONE_COLOR = { r: 0.16, g: 0.73, b: 0.36 }
export const AI_PULSE_PERIOD_MS = 1500
export const AI_DONE_DURATION_MS = 800

/** Opacity of the selection color behind selected text while editing. */
export const TEXT_SELECTION_ALPHA = 0.3
/** The caret's colour where the text's fill gives it none, as Figma's. */
export const TEXT_CARET_COLOR = BLACK
export const TEXT_CARET_WIDTH = 1

export const AUTOMATION_HTTP_PORT = 7600
/**
 * Request header the app's own ACP and Pi harness chats send to the MCP server, so their sessions
 * show as those agents rather than as an outside MCP client.
 */
export const MCP_AGENT_HEADER = 'x-openpencil-agent'

/** The name the app's chats give OpenPencil's MCP server in an agent's session. */
export const OPEN_PENCIL_MCP_SERVER = 'open-pencil'

/**
 * Request header naming the app chat whose agent opens an MCP session, so the app can tell that
 * this chat's agent reached its tools before it sends the prompt.
 */
export const MCP_CHAT_HEADER = 'x-openpencil-chat'

export const GOOGLE_FONTS_API_KEY = 'AIzaSyD1tYDR_dUEiV-Tw1vksEhZbUytgKW5pc8'

export const CJK_FALLBACK_FAMILIES_MACOS = [
  'PingFang SC',
  'PingFang TC',
  'Hiragino Sans',
  'Apple SD Gothic Neo',
  'Heiti SC',
  'Heiti TC'
]

export const CJK_FALLBACK_FAMILIES_WINDOWS = [
  'Microsoft YaHei',
  'Microsoft YaHei UI',
  'Microsoft JhengHei',
  'Yu Gothic',
  'Malgun Gothic',
  'SimHei',
  'SimSun'
]

export const CJK_FALLBACK_FAMILIES_LINUX = [
  'Noto Sans CJK SC',
  'Noto Sans CJK TC',
  'Noto Sans CJK JP',
  'Noto Sans CJK KR',
  'WenQuanYi Micro Hei',
  'Droid Sans Fallback'
]

export const CJK_GOOGLE_FONTS = ['Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR']

/** Figma's #D9D9D9 for new shapes. */
export const DEFAULT_SHAPE_FILL: Fill = {
  type: 'SOLID',
  color: { r: 217 / 255, g: 217 / 255, b: 217 / 255, a: 1 },
  opacity: 1,
  visible: true
}

export const DEFAULT_FRAME_FILL: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 1, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

/** The light or dark interface a new page or section takes its colors from, as in Figma. */
export type InterfaceTheme = 'light' | 'dark'

/** A new page's background, which Figma picks from the interface theme it was made in. */
export const PAGE_DEFAULT_BACKGROUNDS: Record<InterfaceTheme, Color> = {
  light: CANVAS_BG_COLOR,
  dark: { r: 0x1e / 255, g: 0x1e / 255, b: 0x1e / 255, a: 1 }
}

/** A new section's fill, which Figma picks from the interface theme it was made in. */
export const SECTION_DEFAULT_FILLS: Record<InterfaceTheme, Fill> = {
  light: { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true },
  dark: {
    type: 'SOLID',
    color: { r: 0x44 / 255, g: 0x44 / 255, b: 0x44 / 255, a: 1 },
    opacity: 1,
    visible: true
  }
}

export const SECTION_DEFAULT_STROKE: Stroke = {
  type: 'SOLID',
  color: { r: 1, g: 1, b: 1, a: 1 },
  weight: 1,
  opacity: 0.1,
  visible: true,
  align: 'INSIDE'
}

export const SECTION_CORNER_RADIUS = 2

export const ZOOM_DIVISOR = 50
export const ZOOM_SCALE_MIN = 0.75
export const ZOOM_SCALE_MAX = 1.25

export const PEN_CLOSE_THRESHOLD = 8
/**
 * Screen pixels a pencil sample may stray from the line through its neighbours before the curve
 * keeps it, so a stroke drawn zoomed in keeps more detail.
 */
export const PENCIL_TOLERANCE = 2.5
/** A new pencil layer's stroke weight (Figma desktop 126). */
export const PENCIL_STROKE_WEIGHT = 2
export const ROTATION_SNAP_DEGREES = 15
export const HANDLE_HIT_RADIUS = 6
/** How far outside a shape, in screen pixels, a click still selects it (Figma desktop 126). */
export const LAYER_HIT_PAD = 3.5
export const ROTATION_HANDLE_DISTANCE = 24
export const DEFAULT_TEXT_WIDTH = 200
export const DEFAULT_TEXT_HEIGHT = 24
/** Space Figma leaves between a duplicated top-level frame and the layers to its left. */
export const DUPLICATE_FRAME_GAP = 40
