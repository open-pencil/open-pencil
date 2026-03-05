/**
 * Tailwind CSS v4 value resolvers.
 *
 * Converts design token values (px, hex colors, font sizes, etc.) into
 * Tailwind v4 utility class fragments.
 *
 * Tailwind v4 spacing is dynamic: `calc(var(--spacing) * N)` where
 * `--spacing` defaults to `0.25rem` (4px). Any integer works as a class
 * suffix, so we just divide by 4 instead of maintaining a lookup table.
 *
 * Architecture inspired by seanchas116/figma-to-tailwind (MIT)
 * https://github.com/seanchas116/figma-to-tailwind
 */

const FONT_SIZE_TO_TW = new Map<number, string>([
  [12, 'xs'],
  [14, 'sm'],
  [16, 'base'],
  [18, 'lg'],
  [20, 'xl'],
  [24, '2xl'],
  [30, '3xl'],
  [36, '4xl'],
  [48, '5xl'],
  [60, '6xl'],
  [72, '7xl'],
  [96, '8xl'],
  [128, '9xl']
])

const FONT_WEIGHT_TO_TW = new Map<number, string>([
  [100, 'thin'],
  [200, 'extralight'],
  [300, 'light'],
  [400, 'normal'],
  [500, 'medium'],
  [600, 'semibold'],
  [700, 'bold'],
  [800, 'extrabold'],
  [900, 'black']
])

const RADIUS_PX_TO_TW = new Map<number, string>([
  [2, 'sm'],
  [4, 'DEFAULT'],
  [6, 'md'],
  [8, 'lg'],
  [12, 'xl'],
  [16, '2xl'],
  [24, '3xl'],
  [9999, 'full']
])

export function pxToSpacing(px: number): string {
  if (px === 0) return '0'
  if (px === 1) return 'px'
  const n = px / 4
  if (Number.isInteger(n)) return String(n)
  if (n * 2 === Math.round(n * 2)) return String(n)
  return `[${px}px]`
}

export function colorToTwClass(hex: string): string {
  const lower = hex.toLowerCase()
  if (lower === '#ffffff' || lower === '#fff') return 'white'
  if (lower === '#000000' || lower === '#000') return 'black'
  if (lower === '#00000000') return 'transparent'
  return `[${hex}]`
}

export function fontSizeToTw(px: number): string {
  return FONT_SIZE_TO_TW.get(px) ?? `[${px}px]`
}

export function fontWeightToTw(n: number): string {
  return FONT_WEIGHT_TO_TW.get(n) ?? `[${n}]`
}

export function borderRadiusToTw(px: number): string {
  if (px >= 9999) return 'full'
  const name = RADIUS_PX_TO_TW.get(px)
  if (name === 'DEFAULT') return ''
  if (name) return name
  return `[${px}px]`
}

export function opacityToTw(n: number): string {
  const pct = Math.round(n * 100)
  return String(pct)
}
