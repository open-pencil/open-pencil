import type { DrawIOStyle } from './model'

/** A `style` string as its style names and its pairs. */
export function parseStyle(style: string): DrawIOStyle {
  const result: DrawIOStyle = { names: [], values: {} }
  for (const part of style.split(';')) {
    const text = part.trim()
    if (!text) continue
    const eq = text.indexOf('=')
    if (eq === -1) result.names.push(text)
    else result.values[text.slice(0, eq)] = text.slice(eq + 1)
  }
  return result
}

/** A style as draw.io writes it: its names, then `key=value;` pairs, in order. */
export function formatStyle({ names, values }: DrawIOStyle): string {
  const pairs = Object.entries(values).flatMap(([key, value]) =>
    value === undefined ? [] : [`${key}=${value}`]
  )
  return [...names, ...pairs].map((part) => `${part};`).join('')
}

/** A number the style sets for `key`, or `fallback`. */
export function styleNumber(style: DrawIOStyle, key: string, fallback: number): number {
  const value = Number.parseFloat(style.values[key] ?? '')
  return Number.isFinite(value) ? value : fallback
}

/** Whether the style turns `key` on, as `key=1` does. */
export function styleFlag(style: DrawIOStyle, key: string): boolean {
  return style.values[key] === '1'
}
