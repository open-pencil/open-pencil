import svgpath from 'svgpath'

/** Apply a minimal subset of SVG transform attributes to path data. */
export function applySvgTransformToPath(d: string, transform: string | null): string {
  if (!transform || transform === 'none') return d

  let path = svgpath(d)
  const translateMatch = transform.match(/translate\(\s*([-\d.eE+]+)(?:[,\s]+([-\d.eE+]+))?\s*\)/)
  if (translateMatch) {
    const tx = Number.parseFloat(translateMatch[1])
    const ty = Number.parseFloat(translateMatch[2] ?? '0')
    if (Number.isFinite(tx) && Number.isFinite(ty)) {
      path = path.translate(tx, ty)
    }
  }

  const matrixMatch = transform.match(/matrix\(\s*([^)]+)\s*\)/)
  if (matrixMatch) {
    const values = matrixMatch[1]
      .split(/[\s,]+/)
      .map((part) => Number.parseFloat(part))
      .filter((n) => Number.isFinite(n))
    if (values.length === 6) {
      path = path.matrix(values)
    }
  }

  return path.toString()
}