import { parseColor } from '../../../color'
import { generateId } from '../../../scene-graph'

import type {
  Color,
  Effect,
  Fill,
  LayoutAlign,
  LayoutCounterAlign,
  LayoutMode,
  LayoutSizing,
  NodeType,
  SceneGraph,
  SceneNode,
  Stroke,
  StrokeCap,
  StrokeJoin,
  TextAlignVertical,
  Variable,
  VariableCollection,
  VariableCollectionMode,
  VariableType,
  VariableValue
} from '../../../scene-graph'
import type { Vector } from '../../../types'

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
  gap?: number | string
  padding?: number | string | (number | string)[]
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
      id: varId,
      name,
      type: varType,
      collectionId,
      valuesByMode,
      description: '',
      hiddenFromPublishing: false
    }
    graph.addVariable(variable)
    byName.set(name, { id: varId, variable })
  }

  let activeModeId = modes[0].modeId

  function resolveVal(ref: string): VariableValue | undefined {
    const entry = byName.get(ref.replace(/^\$/, ''))
    if (!entry) return undefined
    return (
      entry.variable.valuesByMode[activeModeId] ?? Object.values(entry.variable.valuesByMode)[0]
    )
  }

  return {
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
      return typeof val === 'string' ? val : ''
    },
    setActiveTheme(themeName: string) {
      const modeId = modeByThemeValue.get(`theme:${themeName}`)
      if (modeId) {
        activeModeId = modeId
        graph.activeMode.set(collectionId, modeId)
      }
    }
  }
}

function parseFillColor(fill: string | PenFillObject, ctx: VarContext): Color {
  const raw = typeof fill === 'string' ? fill : fill.color
  return isVarRef(raw) ? ctx.resolveColor(raw) : parseColor(raw)
}

export function convertFill(fill: PenFill | undefined, ctx: VarContext, node?: SceneNode): Fill[] {
  if (fill === undefined) return []
  const fills = Array.isArray(fill) ? fill : [fill]
  return fills.map((item, index) => {
    const visible = typeof item === 'string' ? true : item.enabled !== false
    const color = parseFillColor(item, ctx)
    const result: Fill = { type: 'SOLID', visible, opacity: color.a, color }
    if (node) bindIfVar(node, `fills[${index}]`, typeof item === 'string' ? item : item.color, ctx)
    return result
  })
}

function strokeWeight(stroke: PenStroke): number {
  return typeof stroke.thickness === 'number'
    ? stroke.thickness
    : Math.max(...Object.values(stroke.thickness))
}

export function convertStroke(
  stroke: PenStroke | undefined,
  ctx: VarContext,
  node?: SceneNode
): Stroke[] {
  if (!stroke?.fill) return []
  const color = isVarRef(stroke.fill) ? ctx.resolveColor(stroke.fill) : parseColor(stroke.fill)
  let align: Stroke['align'] = 'CENTER'
  if (stroke.align === 'inside') align = 'INSIDE'
  else if (stroke.align === 'outside') align = 'OUTSIDE'

  const result: Stroke = {
    visible: true,
    color,
    opacity: color.a,
    weight: strokeWeight(stroke),
    align,
    dashPattern: []
  }
  if (node) {
    bindIfVar(node, 'strokes[0]', stroke.fill, ctx)
    if (typeof stroke.thickness === 'object') {
      node.independentStrokeWeights = true
      node.borderTopWeight = stroke.thickness.top ?? 0
      node.borderRightWeight = stroke.thickness.right ?? 0
      node.borderBottomWeight = stroke.thickness.bottom ?? 0
      node.borderLeftWeight = stroke.thickness.left ?? 0
    }
    node.strokeJoin = mapStrokeJoin(stroke.join)
    node.strokeCap = mapStrokeCap(stroke.cap)
  }
  return [result]
}

function mapStrokeJoin(join: string | undefined): StrokeJoin {
  if (join === 'round') return 'ROUND'
  if (join === 'bevel') return 'BEVEL'
  return 'MITER'
}

function mapStrokeCap(cap: string | undefined): StrokeCap {
  if (cap === 'round') return 'ROUND'
  if (cap === 'square') return 'SQUARE'
  return 'NONE'
}

export function convertEffects(effect: PenEffect | PenEffect[] | undefined): Effect[] {
  if (!effect) return []
  const effects = Array.isArray(effect) ? effect : [effect]
  return effects.flatMap((item) => {
    if (item.type !== 'shadow') return []
    const color = item.color ? parseColor(item.color) : { r: 0, g: 0, b: 0, a: 0.25 }
    return [
      {
        type: item.shadowType === 'inner' ? 'INNER_SHADOW' : 'DROP_SHADOW',
        visible: true,
        blendMode: 'NORMAL',
        color,
        offset: item.offset ?? { x: 0, y: 0 },
        radius: item.blur ?? 0,
        spread: item.spread ?? 0
      } satisfies Effect
    ]
  })
}

export function applyCornerRadius(
  node: SceneNode,
  radius: PenNode['cornerRadius'],
  ctx: VarContext
): void {
  if (radius === undefined) return
  if (Array.isArray(radius)) {
    const values = radius.map((value) => parseSize(value, 0, ctx).value)
    node.independentCorners = true
    node.topLeftRadius = values[0] ?? 0
    node.topRightRadius = values[1] ?? 0
    node.bottomRightRadius = values[2] ?? 0
    node.bottomLeftRadius = values[3] ?? 0
    return
  }
  node.cornerRadius = parseSize(radius, 0, ctx).value
}

export function applyPadding(node: SceneNode, padding: PenNode['padding'], ctx?: VarContext): void {
  if (padding === undefined) return
  const resolve = (v: number | string): number =>
    typeof v === 'string' ? (isVarRef(v) && ctx ? ctx.resolveNumber(v) : (Number(v) || 0)) : v
  if (Array.isArray(padding)) {
    node.paddingTop = resolve(padding[0] ?? 0)
    node.paddingRight = resolve(padding[1] ?? 0)
    node.paddingBottom = resolve(padding[2] ?? 0)
    node.paddingLeft = resolve(padding[3] ?? 0)
    return
  }
  const resolved = resolve(padding)
  node.paddingTop = resolved
  node.paddingRight = resolved
  node.paddingBottom = resolved
  node.paddingLeft = resolved
}

export function parseSize(value: number | string | undefined, fallback: number, ctx?: VarContext) {
  if (value === undefined) return { value: fallback, sizing: 'FIXED' as LayoutSizing }
  if (typeof value === 'number') return { value, sizing: 'FIXED' as LayoutSizing }
  if (value === 'fill_container') return { value: fallback, sizing: 'FILL' as LayoutSizing }
  if (value === 'hug_content') return { value: fallback, sizing: 'HUG' as LayoutSizing }
  if (isVarRef(value) && ctx)
    return { value: ctx.resolveNumber(value), sizing: 'FIXED' as LayoutSizing }
  const parsed = Number(value)
  return { value: Number.isFinite(parsed) ? parsed : fallback, sizing: 'FIXED' as LayoutSizing }
}

export function mapLayoutMode(pen: PenNode): LayoutMode {
  if (pen.layout === 'row' || pen.layout === 'horizontal') return 'HORIZONTAL'
  if (pen.layout === 'column' || pen.layout === 'vertical') return 'VERTICAL'
  return 'NONE'
}

export function mapJustifyContent(value: string | undefined): LayoutAlign {
  if (value === 'center') return 'CENTER'
  if (value === 'end') return 'MAX'
  if (value === 'space-between') return 'SPACE_BETWEEN'
  return 'MIN'
}

export function mapAlignItems(value: string | undefined): LayoutCounterAlign {
  if (value === 'center') return 'CENTER'
  if (value === 'end') return 'MAX'
  if (value === 'stretch') return 'STRETCH'
  return 'MIN'
}

export function mapTextAlign(value: string | undefined): SceneNode['textAlignHorizontal'] {
  if (value === 'center') return 'CENTER'
  if (value === 'right' || value === 'end') return 'RIGHT'
  if (value === 'justified') return 'JUSTIFIED'
  return 'LEFT'
}

export function mapTextAlignVertical(value: string | undefined): TextAlignVertical {
  if (value === 'center') return 'CENTER'
  if (value === 'bottom' || value === 'end') return 'BOTTOM'
  return 'TOP'
}

export function mapFontWeight(value: string | number | undefined): number {
  if (typeof value === 'number') return value
  if (value === 'thin') return 100
  if (value === 'extralight') return 200
  if (value === 'light') return 300
  if (value === 'medium') return 500
  if (value === 'semibold') return 600
  if (value === 'bold') return 700
  if (value === 'extrabold') return 800
  if (value === 'black') return 900
  return 400
}

export function mapNodeType(pen: PenNode): NodeType {
  if (pen.type === 'frame') return pen.reusable ? 'COMPONENT' : 'FRAME'
  if (pen.type === 'rectangle') return 'RECTANGLE'
  if (pen.type === 'ellipse') return 'ELLIPSE'
  if (pen.type === 'text' || pen.type === 'icon_font') return 'TEXT'
  if (pen.type === 'path') return 'VECTOR'
  if (pen.type === 'ref') return 'INSTANCE'
  return 'FRAME'
}
