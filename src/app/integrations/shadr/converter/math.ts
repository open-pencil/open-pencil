/** Parses coordinate values or simple Shadr screen offsets (e.g. "1920/2 - 130") */
export function parseCoordinate(val: number | string | undefined, defaultValue = 0): number {
  if (typeof val === 'number') return val
  if (!val) return defaultValue

  const expr = String(val)
    .replace(/halfWidth/gi, '960')
    .replace(/halfHeight/gi, '540')
    .replace(/1920\/2/g, '960')
    .replace(/1080\/2/g, '540')

  const match = expr.match(/^\s*(-?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*$/)
  if (match) {
    const [, a, op, b] = match
    return op === '+' ? Number(a) + Number(b) : Number(a) - Number(b)
  }

  const num = Number(expr)
  return Number.isFinite(num) ? num : defaultValue
}
