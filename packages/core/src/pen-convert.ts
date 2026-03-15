import { parseColor } from './color'
import { generateId } from './scene-graph'

import type { Vector } from './types'

import type {
  Color,
  Fill,
  Stroke,
  StrokeCap,
  StrokeJoin,
  Effect,
  LayoutMode,
  LayoutAlign,
  LayoutCounterAlign,
  LayoutSizing,
  NodeType,
  SceneNode,
  SceneGraph,
  TextAlignVertical,
  Variable,
  VariableCollection,
  VariableCollectionMode,
  VariableType,
  VariableValue
} from './scene-graph'

// .pen JSON schema types

export interface PenDocument {
  version: string
  children: PenNode[]
  themes?: Record<string, string[]>
  variables?: Record<string, PenVariable>
}

export interface PenVariable {
  type: 'color' | 'string' | 'number'
  value: PenVariableValue[] | PenVariableValue | string | number
}

interface PenVariableValue {
  value: string | number
  theme?: Record<string, string>
}

interface PenStroke {
  align: 'inside' | 'center' | 'outside'
  thickness: number | { top?: number; right?: number; bottom?: number; left?: number }
  fill?: string
  join?: string
  cap?: string
}

interface PenEffect {
  type: string
  shadowType?: string
  color?: string
  offset?: Vector
  blur?: number
  spread?: number
}

interface PenFillObject {
  type: string
  color: string
  enabled?: boolean
}

type PenFill = string | PenFillObject | PenFillObject[]

export interface PenNode {
  type: string
  id: string
  name?: string
  x?: number
  y?: number
  width?: number | string
  height?: number | string
  fill?: PenFill
  opacity?: number
  enabled?: boolean
  clip?: boolean
  rotation?: number
  flipX?: boolean
  flipY?: boolean
  reusable?: boolean
  cornerRadius?: number | string | (number | string)[]
  stroke?: PenStroke
  effect?: PenEffect | PenEffect[]
  layout?: string
  gap?: number
  padding?: number | number[]
  justifyContent?: string
  alignItems?: string
  children?: PenNode[]
  content?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  lineHeight?: number
  letterSpacing?: number
  textAlign?: string
  textAlignVertical?: string
  textGrowth?: string
  ref?: string
  descendants?: Record<string, Partial<PenNode>>
  slot?: string[]
  geometry?: string
  iconFontName?: string
  iconFontFamily?: string
  weight?: number
  model?: string
  theme?: Record<string, string>
}

export interface VarContext {
  byName: Map<string, { id: string; variable: Variable }>
  activeModeId: string
  collectionId: string
  modeByThemeName: Map<string, string>
  resolveColor(ref: string): Color
  resolveNumber(ref: string): number
  resolveString(ref: string): string
  setActiveTheme(themeName: string): void
}

// Variable helpers

function penVarTypeToSceneType(t: string): VariableType {
  if (t === 'color') return 'COLOR'
  if (t === 'number') return 'FLOAT'
  return 'STRING'
}

function penValueToSceneValue(raw: string | number, type: VariableType): VariableValue {
  if (type === 'COLOR' && typeof raw === 'string') return parseColor(raw)
  if (type === 'FLOAT' && typeof raw === 'number') return raw
  if (type === 'STRING') return String(raw)
  if (typeof raw === 'number') return raw
  return String(raw)
}

function defaultForType(type: VariableType): VariableValue {
  if (type === 'COLOR') return { r: 0, g: 0, b: 0, a: 1 }
  if (type === 'FLOAT') return 0
  if (type === 'BOOLEAN') return false
  return ''
}

export function isVarRef(val: unknown): val is string {
  return typeof val === 'string' && val.startsWith('$--')
}

function varName(ref: string): string {
  return ref.replace(/^\$/, '')
}

export function bindIfVar(node: SceneNode, field: string, val: unknown, ctx: VarContext): void {
  if (!isVarRef(val)) return
  const entry = ctx.byName.get(varName(val))
  if (entry) node.boundVariables[field] = entry.id
}

export function buildVarContext(
  graph: SceneGraph,
  penVars: Record<string, PenVariable>,
  themes: Record<string, string[]>
): VarContext {
  const collectionId = generateId()
  const modes: VariableCollectionMode[] = []
  const themeKeys = Object.keys(themes)

  if (themeKeys.length > 0) {
    const themeKey = themeKeys[0]
    for (const modeName of themes[themeKey]) {
      modes.push({ modeId: generateId(), name: modeName })
    }
  }
  if (modes.length === 0) {
    modes.push({ modeId: generateId(), name: 'Default' })
  }

  const collection: VariableCollection = {
    id: collectionId,
    name: 'Variables',
    modes,
    defaultModeId: modes[0].modeId,
    variableIds: []
  }
  graph.addCollection(collection)

  const modeByThemeValue = new Map<string, string>()
  if (themeKeys.length > 0) {
    const themeKey = themeKeys[0]
    for (const mode of modes) {
      modeByThemeValue.set(`${themeKey}:${mode.name}`, mode.modeId)
    }
  }

  const byName = new Map<string, { id: string; variable: Variable }>()

  for (const [name, def] of Object.entries(penVars)) {
    const varId = generateId()
    const varType = penVarTypeToSceneType(def.type)
    const valuesByMode: Record<string, VariableValue> = {}

    if (Array.isArray(def.value)) {
      for (const entry of def.value) {
        if (entry.theme) {
          const [tKey, tVal] = Object.entries(entry.theme)[0]
          const modeId = modeByThemeValue.get(`${tKey}:${tVal}`)
          if (modeId) valuesByMode[modeId] = penValueToSceneValue(entry.value, varType)
        } else {
          valuesByMode[modes[0].modeId] = penValueToSceneValue(entry.value, varType)
        }
      }
    } else {
      valuesByMode[modes[0].modeId] = penValueToSceneValue(def.value as string | number, varType)
    }

    for (const mode of modes) {
      if (!(mode.modeId in valuesByMode)) {
        valuesByMode[mode.modeId] = valuesByMode[modes[0].modeId] ?? defaultForType(varType)
      }
    }

    const variable: Variable = {
      id: varId, name, type: varType, collectionId, valuesByMode,
      description: '', hiddenFromPublishing: false
    }
    graph.addVariable(variable)
    byName.set(name, { id: varId, variable })
  }

  let activeModeId = modes[0].modeId

  function resolveVal(ref: string): VariableValue | undefined {
    const entry = byName.get(ref.replace(/^\$/, ''))
    if (!entry) return undefined
    return entry.variable.valuesByMode[activeModeId]
      ?? Object.values(entry.variable.valuesByMode)[0]
  }

  const ctx: VarContext = {
    byName,
    activeModeId,
    collectionId,
    modeByThemeName: modeByThemeValue,
    resolveColor(ref: string): Color {
      const val = resolveVal(ref)
      if (val === undefined) return parseColor(ref)
      if (typeof val === 'object' && 'r' in val) return val
      if (typeof val === 'string') return parseColor(val)
      return { r: 0, g: 0, b: 0, a: 1 }
    },
    resolveNumber(ref: string): number {
      const val = resolveVal(ref)
      return typeof val === 'number' ? val : 0
    },
    resolveString(ref: string): string {
      const val = resolveVal(ref)
      if (typeof val === 'string') return val
      if (typeof val === 'number' || typeof val === 'boolean') return String(val)
      if (val === undefined) return ref
      return JSON.stringify(val)
    },
    setActiveTheme(themeName: string): void {
      for (const [key, modeId] of modeByThemeValue) {
        if (key.endsWith(`:${themeName}`)) {
          activeModeId = modeId
          ctx.activeModeId = modeId
          graph.activeMode.set(collectionId, modeId)
          return
        }
      }
    }
  }

  return ctx
}

// Fill conversion

export function convertFill(pen: PenFill, ctx: VarContext, node: SceneNode): Fill[] {
  if (Array.isArray(pen)) {
    if (pen.length === 0) return []
    return pen.map((f) => convertFillObject(f, ctx, node))
  }
  if (typeof pen === 'object') {
    return [convertFillObject(pen, ctx, node)]
  }
  if (typeof pen === 'string') {
    if (isVarRef(pen)) {
      bindIfVar(node, 'fills[0].color', pen, ctx)
      return [{ type: 'SOLID', color: ctx.resolveColor(pen), opacity: 1, visible: true, blendMode: 'NORMAL' }]
    }
    return [{ type: 'SOLID', color: parseColor(pen), opacity: 1, visible: true, blendMode: 'NORMAL' }]
  }
  return []
}

function convertFillObject(obj: PenFillObject, ctx: VarContext, node: SceneNode): Fill {
  const color = isVarRef(obj.color) ? ctx.resolveColor(obj.color) : parseColor(obj.color)
  if (isVarRef(obj.color)) bindIfVar(node, 'fills[0].color', obj.color, ctx)
  return { type: 'SOLID', color, opacity: 1, visible: obj.enabled !== false, blendMode: 'NORMAL' }
}

// Stroke conversion

export function convertStroke(pen: PenStroke, ctx: VarContext, node: SceneNode): Stroke[] {
  if (typeof pen.thickness === 'object') {
    node.independentStrokeWeights = true
    node.borderTopWeight = pen.thickness.top ?? 0
    node.borderRightWeight = pen.thickness.right ?? 0
    node.borderBottomWeight = pen.thickness.bottom ?? 0
    node.borderLeftWeight = pen.thickness.left ?? 0
  }

  const weight = typeof pen.thickness === 'number' ? pen.thickness : 1
  let color: Color = { r: 0, g: 0, b: 0, a: 1 }
  let hasColor = false

  if (pen.fill) {
    hasColor = true
    if (isVarRef(pen.fill)) {
      color = ctx.resolveColor(pen.fill)
      bindIfVar(node, 'strokes[0].color', pen.fill, ctx)
    } else {
      color = parseColor(pen.fill)
    }
  }

  if (!hasColor && typeof pen.thickness === 'object') return []
  if (!hasColor) return []

  const stroke: Stroke = {
    color, opacity: 1, visible: true, weight,
    align: pen.align === 'center' ? 'CENTER' : (pen.align === 'outside' ? 'OUTSIDE' : 'INSIDE')
  }
  if (pen.join) {
    stroke.join = pen.join.toUpperCase() as StrokeJoin
    node.strokeJoin = stroke.join
  }
  if (pen.cap) {
    stroke.cap = pen.cap.toUpperCase() as StrokeCap
    node.strokeCap = stroke.cap
  }
  return [stroke]
}

// Effect conversion

function convertEffect(pen: PenEffect): Effect {
  if (pen.type === 'shadow') {
    return {
      type: pen.shadowType === 'inner' ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: pen.color ? parseColor(pen.color) : { r: 0, g: 0, b: 0, a: 0.25 },
      offset: pen.offset ?? { x: 0, y: 0 },
      radius: pen.blur ?? 0,
      spread: pen.spread ?? 0,
      visible: true, blendMode: 'NORMAL'
    }
  }
  return {
    type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 0 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL'
  }
}

export function convertEffects(pen: PenEffect | PenEffect[] | undefined): Effect[] {
  if (!pen) return []
  if (Array.isArray(pen)) {
    if (pen.length === 0) return []
    return pen.map(convertEffect)
  }
  return [convertEffect(pen)]
}

// Size/layout sizing

export interface SizeParsed {
  value: number
  sizing: LayoutSizing
  min?: number
}

export function parseSize(raw: number | string | undefined, fallback: number): SizeParsed {
  if (raw === undefined) return { value: fallback, sizing: 'FIXED' }
  if (typeof raw === 'number') return { value: raw, sizing: 'FIXED' }

  if (raw === 'fill_container') return { value: fallback, sizing: 'FILL' }
  const fillMatch = raw.match(/^fill_container\((\d+)\)$/)
  if (fillMatch) return { value: parseInt(fillMatch[1], 10), sizing: 'FILL' }

  if (raw === 'fit_content') return { value: fallback, sizing: 'HUG' }
  const hugMatch = raw.match(/^fit_content\((\d+)\)$/)
  if (hugMatch) return { value: parseInt(hugMatch[1], 10), sizing: 'HUG', min: parseInt(hugMatch[1], 10) }

  return { value: fallback, sizing: 'FIXED' }
}

// Corner radius

export function applyCornerRadius(
  node: SceneNode,
  raw: number | string | (number | string)[] | undefined,
  ctx: VarContext
): void {
  if (raw === undefined) return
  if (typeof raw === 'number') { node.cornerRadius = raw; return }
  if (typeof raw === 'string') {
    if (isVarRef(raw)) {
      node.cornerRadius = ctx.resolveNumber(raw)
      bindIfVar(node, 'cornerRadius', raw, ctx)
    } else {
      node.cornerRadius = parseFloat(raw) || 0
    }
    return
  }
  if (Array.isArray(raw) && raw.length === 4) {
    node.independentCorners = true
    const resolve = (v: number | string): number => {
      if (typeof v === 'number') return v
      if (isVarRef(v)) return ctx.resolveNumber(v)
      return parseFloat(v) || 0
    }
    node.topLeftRadius = resolve(raw[0])
    node.topRightRadius = resolve(raw[1])
    node.bottomRightRadius = resolve(raw[2])
    node.bottomLeftRadius = resolve(raw[3])
    if (isVarRef(raw[0])) bindIfVar(node, 'topLeftRadius', raw[0], ctx)
    if (isVarRef(raw[1])) bindIfVar(node, 'topRightRadius', raw[1], ctx)
    if (isVarRef(raw[2])) bindIfVar(node, 'bottomRightRadius', raw[2], ctx)
    if (isVarRef(raw[3])) bindIfVar(node, 'bottomLeftRadius', raw[3], ctx)
  }
}

// Padding

export function applyPadding(node: SceneNode, raw: number | number[] | undefined): void {
  if (raw === undefined) return
  if (typeof raw === 'number') {
    node.paddingTop = raw; node.paddingRight = raw
    node.paddingBottom = raw; node.paddingLeft = raw
    return
  }
  if (raw.length === 2) {
    node.paddingTop = raw[0]; node.paddingBottom = raw[0]
    node.paddingRight = raw[1]; node.paddingLeft = raw[1]
    return
  }
  if (raw.length === 4) {
    node.paddingTop = raw[0]; node.paddingRight = raw[1]
    node.paddingBottom = raw[2]; node.paddingLeft = raw[3]
  }
}

// Layout mapping

const AUTO_LAYOUT_TYPES = new Set(['frame', 'ref'])

export function mapLayoutMode(pen: PenNode): LayoutMode {
  if (pen.layout === 'none') return 'NONE'
  if (pen.layout === 'vertical') return 'VERTICAL'
  if (AUTO_LAYOUT_TYPES.has(pen.type) && pen.layout === undefined) return 'HORIZONTAL'
  return 'NONE'
}

export function mapJustifyContent(val: string | undefined): LayoutAlign {
  if (!val) return 'MIN'
  if (val === 'center') return 'CENTER'
  if (val === 'end') return 'MAX'
  if (val === 'space_between') return 'SPACE_BETWEEN'
  return 'MIN'
}

export function mapAlignItems(val: string | undefined): LayoutCounterAlign {
  if (!val) return 'MIN'
  if (val === 'center') return 'CENTER'
  if (val === 'end') return 'MAX'
  return 'MIN'
}

export function mapTextAlign(val: string | undefined): 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' {
  if (val === 'center') return 'CENTER'
  if (val === 'right') return 'RIGHT'
  if (val === 'justified') return 'JUSTIFIED'
  return 'LEFT'
}

export function mapTextAlignVertical(val: string | undefined): TextAlignVertical {
  if (val === 'middle') return 'CENTER'
  if (val === 'bottom') return 'BOTTOM'
  return 'TOP'
}

export function mapFontWeight(val: string | number | undefined): number {
  if (val === undefined) return 400
  if (typeof val === 'number') return val
  const num = parseInt(val, 10)
  if (!Number.isNaN(num)) return num
  if (val === 'bold') return 700
  return 400
}

export function mapNodeType(pen: PenNode): NodeType {
  if (pen.type === 'ref') return 'INSTANCE'
  if (pen.reusable) return 'COMPONENT'
  switch (pen.type) {
    case 'frame': return 'FRAME'
    case 'text': return 'TEXT'
    case 'rectangle': return 'RECTANGLE'
    case 'ellipse': return 'ELLIPSE'
    case 'line': return 'LINE'
    case 'path': return 'VECTOR'
    case 'icon_font': return 'TEXT'
    default: return 'FRAME'
  }
}
