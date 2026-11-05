import { IS_BROWSER, IS_TAURI } from '@open-pencil/core/constants'

export {
  IS_BROWSER,
  IS_TAURI,
  SELECTION_COLOR,
  COMPONENT_COLOR,
  SNAP_COLOR,
  CANVAS_BG_COLOR,
  SNAP_THRESHOLD_SCREEN_PX,
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
} from '@open-pencil/core/constants'

import type { Color } from '@open-pencil/scene-graph/primitives'

/**
 * The collaboration namespace. It names the shared document format and how peers send it, so
 * builds that sync the layer tree or variables differently, or encode what they send
 * differently, never join each other's rooms; change it with either.
 */
export const COLLAB_APP_ID = 'openpencil/7'

// 32 base36 characters provide roughly 165 bits of entropy. The room ID is a
// bearer credential and must resist offline enumeration from public signaling topics.
export const ROOM_ID_LENGTH = 32
export const ROOM_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
/** How long a room tab tries to reach the service that introduces peers before saying it cannot. */
export const ROOM_UNREACHABLE_MS = 20_000
/** How often a room tab rechecks its connection while it waits for the file. */
export const ROOM_STATUS_TICK_MS = 500

export const WEB_APP_ORIGIN = 'https://app.openpencil.dev'
/** The privacy page: every request the app makes, and every usage event and field. */
export const PRIVACY_URL = 'https://openpencil.dev/overview/privacy'
/** The OpenPencil Cloud section of the website, with its waitlist form. */
export const CLOUD_WAITLIST_URL = 'https://openpencil.dev/#cloud'
/**
 * The hosted OpenPencil Cloud server, offered first when connecting. An official deployment's own
 * editor build names that deployment, such as staging.
 */
export const OFFICIAL_CLOUD_URL =
  (typeof __OPENPENCIL_OFFICIAL_CLOUD_URL__ === 'string' && __OPENPENCIL_OFFICIAL_CLOUD_URL__) ||
  'https://cloud.openpencil.dev'
/** Whether this is the editor a Cloud server serves on its own address (`bun run build:cloud`). */
export const IS_CLOUD_SITE =
  typeof __OPENPENCIL_CLOUD_SITE__ === 'boolean' && __OPENPENCIL_CLOUD_SITE__
/** Where the desktop app's installers are published. */
export const DESKTOP_DOWNLOAD_URL = 'https://github.com/open-pencil/open-pencil/releases/latest'
export const NODE_DOWNLOAD_URL = 'https://nodejs.org/en/download'

/**
 * Published guides. Settings links each integration section to its guide with one "Learn more"
 * at the end of the section description; alerts link only to the fix, never to docs.
 */
const DOCS_ORIGIN = 'https://openpencil.dev'
export const MCP_SERVER_DOCS_URL = `${DOCS_ORIGIN}/programmable/mcp-server`
/** The guide to OpenPencil Cloud, linked from the Cloud server's own pages. */
export const CLOUD_DOCS_URL = `${DOCS_ORIGIN}/user-guide/openpencil-cloud`
export const WEBMCP_DOCS_URL = `${MCP_SERVER_DOCS_URL}#webmcp`
export const MCP_CONNECTIONS_DOCS_URL = `${DOCS_ORIGIN}/programmable/ai-chat#external-mcp-connections`
export const CODING_AGENTS_GUIDE_URL = `${DOCS_ORIGIN}/programmable/coding-agents`
export const PI_GUIDE_URL = `${CODING_AGENTS_GUIDE_URL}#pi`

/** The published release page, with its full notes, for a desktop version. */
export function releaseNotesURL(version: string): string {
  return `https://github.com/open-pencil/open-pencil/releases/tag/v${version}`
}

export function getShareURL(roomId: string): string {
  const base = IS_TAURI || !IS_BROWSER ? WEB_APP_ORIGIN : window.location.origin
  return `${base}/rooms/${roomId}`
}

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

export {
  DEFAULT_SHAPE_FILL,
  DEFAULT_FRAME_FILL,
  ZOOM_DIVISOR,
  ZOOM_SCALE_MIN,
  ZOOM_SCALE_MAX
} from '@open-pencil/core/constants'

export const ASSET_GRID_THUMBNAIL_SIZE = 96
export const ASSET_LIST_THUMBNAIL_SIZE = 40
export const ASSET_THUMBNAIL_RENDER_SCALE = 2

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
export const DEFAULT_TEXT_WIDTH = 200
export const DEFAULT_TEXT_HEIGHT = 24

export const ACP_PERMISSION_TIMEOUT_MS = 60_000
/** How long a request waits unanswered before a notification says an agent needs you. */
export const AGENT_INPUT_NOTIFY_DELAY_MS = 6_000
