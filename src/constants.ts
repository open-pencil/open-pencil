export {
  IS_TAURI,
  SELECTION_COLOR,
  COMPONENT_COLOR,
  SNAP_COLOR,
  CANVAS_BG_COLOR,
  SNAP_THRESHOLD,
  RULER_SIZE,
  RULER_BG_COLOR,
  RULER_TICK_COLOR,
  RULER_TEXT_COLOR,
  RULER_BADGE_HEIGHT,
  RULER_BADGE_PADDING,
  RULER_BADGE_RADIUS,
  RULER_BADGE_EXCLUSION,
  RULER_TEXT_BASELINE,
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_HIGHLIGHT_ALPHA,
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS,
  PEN_CLOSE_RADIUS_BOOST,
  PEN_PATH_STROKE_WIDTH,
  PARENT_OUTLINE_ALPHA,
  PARENT_OUTLINE_DASH,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SIZE_FONT_SIZE,
  HANDLE_HALF_SIZE,
  LABEL_OFFSET_Y,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y,
  MARQUEE_FILL_ALPHA,
  SELECTION_DASH_ALPHA,
  DROP_HIGHLIGHT_ALPHA,
  DROP_HIGHLIGHT_STROKE,
  LAYOUT_INDICATOR_STROKE,
  SECTION_CORNER_RADIUS,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_GAP,
  COMPONENT_SET_DASH,
  COMPONENT_SET_DASH_GAP,
  COMPONENT_SET_BORDER_WIDTH,
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  COMPONENT_LABEL_ICON_GAP,
  RULER_TARGET_PIXEL_SPACING,
  RULER_MAJOR_TOLERANCE
} from '@open-pencil/core'

import type { Color, Fill, Stroke } from '@open-pencil/core'

export const TRYSTERO_APP_ID = 'openpencil'
export const ROOM_ID_LENGTH = 8
export const ROOM_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

export const PEER_COLORS: Color[] = [
  { r: 0.96, g: 0.26, b: 0.21, a: 1 },
  { r: 0.13, g: 0.59, b: 0.95, a: 1 },
  { r: 0.3, g: 0.69, b: 0.31, a: 1 },
  { r: 1.0, g: 0.76, b: 0.03, a: 1 },
  { r: 0.61, g: 0.15, b: 0.69, a: 1 },
  { r: 1.0, g: 0.34, b: 0.13, a: 1 },
  { r: 0.0, g: 0.74, b: 0.83, a: 1 },
  { r: 0.91, g: 0.12, b: 0.39, a: 1 }
]

export const YJS_JSON_FIELDS = new Set([
  'childIds',
  'fills',
  'strokes',
  'effects',
  'vectorNetwork',
  'boundVariables',
  'styleRuns'
])

export const DEFAULT_SHAPE_FILL: Fill = {
  type: 'SOLID',
  color: { r: 0.83, g: 0.83, b: 0.83, a: 1 },
  opacity: 1,
  visible: true
}

export const DEFAULT_FRAME_FILL: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 1, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

export const HANDLE_SIZE = 6

export const HALF_FRAC = 3 / 7
export const HUD_TOP = 12 + 32 + 6 + 32 + 12

export const SWIPE_THRESHOLD = 30
export const SWIPE_VELOCITY_THRESHOLD = 500
export const DRAWER_SPRING_STIFFNESS = 800
export const DRAWER_SPRING_DAMPING = 50

export const ACTION_TOAST_DURATION = 800
export const DRAG_DEAD_ZONE = 4
export const PEN_CLOSE_THRESHOLD = 8
export const ROTATION_SNAP_DEGREES = 15
export const CORNER_ROTATE_ZONE = 16
export const DEFAULT_TEXT_WIDTH = 200
export const DEFAULT_TEXT_HEIGHT = 24
export const AUTO_LAYOUT_BREAK_THRESHOLD = 8
export const HANDLE_HIT_RADIUS = 6

// Pixels of deltaY for one e-fold of zoom (Math.exp(-deltaY / ZOOM_DIVISOR))
// Trackpad pinch sends small deltas (~2-5px), mouse wheel sends large (~100px).
// Lower = more responsive. 50 matches Figma's trackpad feel.
export const ZOOM_DIVISOR = 50
// Clamp scale factor per wheel flush to prevent jarring jumps from mouse wheels
export const ZOOM_SCALE_MIN = 0.75
export const ZOOM_SCALE_MAX = 1.25

export const SECTION_DEFAULT_FILL: Fill = {
  type: 'SOLID',
  color: { r: 0.37, g: 0.37, b: 0.37, a: 1 },
  opacity: 1,
  visible: true
}
export const SECTION_DEFAULT_STROKE: Stroke = {
  color: { r: 0.55, g: 0.55, b: 0.55, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'INSIDE'
}
