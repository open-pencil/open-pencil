import type { Color } from './types'

export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
export const DEFAULT_FONT_SIZE = 14
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

export const TEXT_SELECTION_COLOR = { r: 0.26, g: 0.52, b: 0.96, a: 0.3 }
export const TEXT_CARET_COLOR = { r: 0, g: 0, b: 0, a: 1 }
export const TEXT_CARET_WIDTH = 1
