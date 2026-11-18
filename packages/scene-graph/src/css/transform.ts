import valueParser from 'postcss-value-parser'

import Matrix, { type Mat3 } from '../matrix'
import type { Vector } from '../primitives'
import { dimension, splitCSSValue } from './values'

/** The size percentages in a transform resolve against: the element's border box. */
export interface CSSTransformBox {
  width: number
  height: number
}

/** The properties that transform an element, as CSS applies them: translate, rotate, scale, transform. */
export interface CSSTransformStyle {
  transform?: string
  translate?: string
  rotate?: string
  scale?: string
}

const ANGLE_UNITS: Partial<Record<string, number>> = {
  deg: Math.PI / 180,
  rad: 1,
  grad: Math.PI / 200,
  turn: Math.PI * 2
}

/** An angle in radians; a bare zero counts, as CSS allows. Null for anything else. */
function angle(value: string): number | null {
  const parsed = dimension(value.trim())
  if (!parsed) return null
  if (parsed.unit === '') return parsed.number === 0 ? 0 : null
  const radians = ANGLE_UNITS[parsed.unit]
  return radians === undefined ? null : parsed.number * radians
}

/** A length in pixels, a percentage of `extent`, or null for units this cannot resolve. */
function length(value: string, extent: number): number | null {
  const parsed = dimension(value.trim())
  if (!parsed) return null
  if (parsed.unit === '%') return (parsed.number / 100) * extent
  return parsed.unit === 'px' || (parsed.unit === '' && parsed.number === 0) ? parsed.number : null
}

/** A plain number, or a percentage as a fraction, as `scale` takes them. */
function factor(value: string): number | null {
  const parsed = dimension(value.trim())
  if (!parsed) return null
  if (parsed.unit === '%') return parsed.number / 100
  return parsed.unit === '' ? parsed.number : null
}

function skewed(x: number, y: number): Mat3 {
  return [1, Math.tan(x), 0, Math.tan(y), 1, 0, 0, 0, 1]
}

/** The 2D matrix `matrix(a, b, c, d, e, f)` names. */
function affine([a, b, c, d, e, f]: number[]): Mat3 {
  return [a, c, e, b, d, f, 0, 0, 1]
}

function translation(x: string, y: string | undefined, box: CSSTransformBox): Mat3 | null {
  const dx = length(x, box.width)
  const dy = y === undefined ? 0 : length(y, box.height)
  return dx === null || dy === null ? null : Matrix.translated(dx, dy)
}

function scaling(x: string, y: string | undefined): Mat3 | null {
  const sx = factor(x)
  const sy = y === undefined ? sx : factor(y)
  return sx === null || sy === null ? null : Matrix.scaled(sx, sy)
}

function numbers(values: string[]): number[] | null {
  const parsed = values.map(Number)
  return parsed.every(Number.isFinite) ? parsed : null
}

function rotation(value: string | undefined): Mat3 | null {
  const radians = value === undefined ? null : angle(value)
  return radians === null ? null : Matrix.rotated(radians)
}

function skewing(x: string | undefined, y: string | undefined): Mat3 | null {
  const ax = x === undefined ? 0 : angle(x)
  const ay = y === undefined ? 0 : angle(y)
  return ax === null || ay === null ? null : skewed(ax, ay)
}

/** A transform function: how many arguments it takes, and the matrix they make. */
interface TransformFunction {
  arity: readonly [min: number, max: number]
  build: (args: string[], box: CSSTransformBox) => Mat3 | null
}

/** The 2D transform functions by lowercase name; 3D turns and perspective are left out. */
const TRANSFORM_FUNCTIONS: Partial<Record<string, TransformFunction>> = {
  matrix: {
    arity: [6, 6],
    build: (args) => {
      const m = numbers(args)
      return m && affine(m)
    }
  },
  matrix3d: {
    arity: [16, 16],
    build: (args) => {
      const m = numbers(args)
      return m && inPlane(m) ? affine([m[0], m[1], m[4], m[5], m[12], m[13]]) : null
    }
  },
  translate: { arity: [1, 2], build: (args, box) => translation(args[0], args.at(1), box) },
  translate3d: {
    arity: [3, 3],
    build: (args, box) => (depth(args[2]) ? translation(args[0], args[1], box) : null)
  },
  translatex: { arity: [1, 1], build: (args, box) => translation(args[0], undefined, box) },
  translatey: { arity: [1, 1], build: (args, box) => translation('0', args[0], box) },
  rotate: { arity: [1, 1], build: (args) => rotation(args[0]) },
  rotatez: { arity: [1, 1], build: (args) => rotation(args[0]) },
  scale: { arity: [1, 2], build: (args) => scaling(args[0], args.at(1)) },
  scale3d: {
    arity: [3, 3],
    build: (args) => (factor(args[2]) === null ? null : scaling(args[0], args[1]))
  },
  scalex: { arity: [1, 1], build: (args) => scaling(args[0], '1') },
  scaley: { arity: [1, 1], build: (args) => scaling('1', args[0]) },
  skew: { arity: [1, 2], build: (args) => skewing(args[0], args.at(1)) },
  skewx: { arity: [1, 1], build: (args) => skewing(args[0], undefined) },
  skewy: { arity: [1, 1], build: (args) => skewing(undefined, args[0]) }
}

/**
 * Whether a `matrix3d`, column by column, keeps the plane where it was: no turn out of it and no
 * perspective. Depth, which moves nothing on the plane without perspective, may change.
 */
function inPlane(m: number[]): boolean {
  const outOfPlane = [m[2], m[3], m[6], m[7], m[8], m[9], m[11]]
  return outOfPlane.every((value) => value === 0) && m[15] === 1
}

/**
 * Whether a z offset is a length, which a percentage never is. It moves nothing on the plane without perspective, which a
 * layer cannot hold, so it is read and dropped.
 */
function depth(value: string): boolean {
  return !value.trim().endsWith('%') && length(value, 0) !== null
}

/**
 * A function's arguments, which CSS separates with commas: null when one is missing, or two
 * stand without a comma between them.
 */
function functionArguments(nodes: valueParser.Node[]): string[] | null {
  const parts = nodes.filter((node) => node.type !== 'space' && node.type !== 'comment')
  const args: string[] = []
  for (const [index, node] of parts.entries()) {
    const expectsArgument = index % 2 === 0
    if (expectsArgument && node.type !== 'word') return null
    if (!expectsArgument && (node.type !== 'div' || node.value !== ',')) return null
    if (expectsArgument) args.push(node.value)
  }
  return parts.length % 2 === 1 ? args : null
}

/** One transform function as a matrix; null for one this does not know or cannot read. */
function transformFunction(name: string, args: string[], box: CSSTransformBox): Mat3 | null {
  // Own names only, so `constructor` or `__proto__` reads as unknown instead of a prototype member.
  const fn = Object.hasOwn(TRANSFORM_FUNCTIONS, name) ? TRANSFORM_FUNCTIONS[name] : undefined
  if (!fn || args.length < fn.arity[0] || args.length > fn.arity[1]) return null
  return fn.build(args, box)
}

/**
 * A CSS `transform` as a 2D matrix about the transform origin, with percentages resolved against
 * `box`. The identity for `none`; null when it turns out of the plane or cannot be read.
 */
export function parseCSSTransform(value: string | undefined, box: CSSTransformBox): Mat3 | null {
  const text = value?.trim()
  if (!text || text === 'none') return Matrix.identity()
  let matrix = Matrix.identity()
  for (const node of valueParser(text).nodes) {
    if (node.type === 'space' || node.type === 'comment') continue
    if (node.type !== 'function') return null
    const args = functionArguments(node.nodes)
    const step = args && transformFunction(node.value.toLowerCase(), args, box)
    if (!step) return null
    matrix = Matrix.multiply(matrix, step)
  }
  return matrix
}

/** The `rotate` property: an angle, or one about the z axis. Null when it turns out of the plane. */
function rotateProperty(parts: string[]): Mat3 | null {
  const last = parts.at(-1)
  const axis = parts.slice(0, -1).join(' ').toLowerCase()
  const radians = last === undefined ? null : angle(last)
  if (radians === null || !['', 'z', '0 0 1'].includes(axis)) return null
  return Matrix.rotated(radians)
}

/** A transform property's value as a matrix; the identity when it is unset or `none`. */
function property(value: string | undefined, parse: (parts: string[]) => Mat3 | null): Mat3 | null {
  const text = value?.trim()
  if (!text || text === 'none') return Matrix.identity()
  return parse(splitCSSValue(text))
}

/**
 * The 2D matrix about the transform origin that an element's `translate`, `rotate`, `scale`, and
 * `transform` make together, applied in that order as CSS applies them. Null when one of them
 * turns out of the plane or cannot be read.
 */
export function parseCSSTransforms(style: CSSTransformStyle, box: CSSTransformBox): Mat3 | null {
  const steps = [
    property(style.translate, (parts) => {
      const [x, y, z] = [parts.at(0), parts.at(1), parts.at(2)]
      if (x === undefined || parts.length > 3 || (z !== undefined && !depth(z))) return null
      return translation(x, y, box)
    }),
    property(style.rotate, rotateProperty),
    property(style.scale, (parts) => {
      const [x, y, z] = [parts.at(0), parts.at(1), parts.at(2)]
      if (x === undefined || parts.length > 3 || (z !== undefined && factor(z) === null)) {
        return null
      }
      return scaling(x, y)
    }),
    parseCSSTransform(style.transform, box)
  ]
  if (steps.some((step) => step === null)) return null
  return Matrix.multiply(...steps.filter((step) => step !== null))
}

const ORIGIN_KEYWORDS: Partial<Record<string, { axis: 'x' | 'y' | 'either'; fraction: number }>> = {
  left: { axis: 'x', fraction: 0 },
  right: { axis: 'x', fraction: 1 },
  top: { axis: 'y', fraction: 0 },
  bottom: { axis: 'y', fraction: 1 },
  center: { axis: 'either', fraction: 0.5 }
}

/**
 * Where a CSS `transform-origin` puts the point an element transforms about, from its border
 * box's top left corner. Its center when it is unset or cannot be read.
 */
export function parseCSSTransformOrigin(value: string | undefined, box: CSSTransformBox): Vector {
  const center = { x: box.width / 2, y: box.height / 2 }
  const tokens = splitCSSValue(value?.trim() ?? '')
  // A third value is the depth, which must be a length; anything past it is not an origin.
  const depthOk = tokens.length < 3 || (tokens.length === 3 && depth(tokens[2]))
  if (tokens.length === 0 || !depthOk) return center
  const parts = tokens.slice(0, 2)
  // A vertical keyword first, as in `top left`, names the y offset.
  const [first = 'center', second = 'center'] = parts.map((part) => part.toLowerCase())
  const swapped = ORIGIN_KEYWORDS[first]?.axis === 'y' || ORIGIN_KEYWORDS[second]?.axis === 'x'
  const [x, y] = swapped ? [second, first] : [first, second]
  const resolve = (part: string, extent: number, axis: 'x' | 'y') => {
    const keyword = ORIGIN_KEYWORDS[part]
    if (!keyword) return length(part, extent)
    return keyword.axis === axis || keyword.axis === 'either' ? keyword.fraction * extent : null
  }
  const ox = resolve(x, box.width, 'x')
  const oy = resolve(y, box.height, 'y')
  return ox === null || oy === null ? center : { x: ox, y: oy }
}
