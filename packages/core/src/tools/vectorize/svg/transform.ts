import svgpath from 'svgpath'

/**
 * Apply an SVG `transform` attribute to path data. Delegates the full transform
 * grammar (translate/scale/rotate/skewX/skewY/matrix and lists) to svgpath rather
 * than parsing a subset ourselves, so non-translate/matrix transforms import
 * correctly. Returns the original path if the transform string can't be applied.
 */
export function applySVGTransformToPath(d: string, transform: string | null): string {
  if (!transform || transform === 'none') return d
  try {
    return svgpath(d).transform(transform).toString()
  } catch (err) {
    console.warn('Ignoring unsupported SVG transform:', transform, err)
    return d
  }
}
