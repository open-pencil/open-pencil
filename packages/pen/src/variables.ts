/**
 * The variable and theme side of a `.pen` document: its declared variables, the theme modes they
 * resolve against, and the context every other reader resolves a `$name` reference through.
 */

import { generateId } from '@open-pencil/scene-graph'
import type {
  Color,
  SceneGraph,
  SceneNode,
  Variable,
  VariableCollection,
  VariableCollectionMode,
  VariableType,
  VariableValue
} from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { BLACK } from '@open-pencil/scene-graph/constants'

export interface PenVariable {
  type: 'color' | 'string' | 'number'
  value: PenVariableValue[] | PenVariableValue | string | number
}

interface PenVariableValue {
  value: string | number
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
  setActiveTheme(themeKey: string, themeName: string): void
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
  if (type === 'COLOR') return { ...BLACK }
  if (type === 'FLOAT') return 0
  if (type === 'BOOLEAN') return false
  return ''
}

export function isVarRef(val: unknown): val is string {
  return typeof val === 'string' && val.startsWith('$') && val.length > 1
}

function varName(ref: string): string {
  return ref.replace(/^\$/, '')
}

export function bindIfVar(node: SceneNode, field: string, val: unknown, ctx: VarContext): void {
  if (!isVarRef(val)) return
  const entry = ctx.byName.get(varName(val))
  if (entry) node.boundVariables[field] = entry.id
}

/** Switches the variable context to the theme a `.pen` node declares. */
export function applyTheme(theme: Record<string, string>, ctx: VarContext): void {
  // A node names one mode per theme axis, and the axis is what the mode was declared under.
  const entries = Object.entries(theme)
  if (entries.length > 0) {
    const [themeKey, themeName] = entries[0]
    ctx.setActiveTheme(themeKey, themeName)
  }
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
    // Reading the mode has to follow what `setActiveTheme` switches, so it is never a copy.
    get activeModeId() {
      return activeModeId
    },
    collectionId,
    modeByThemeName: modeByThemeValue,
    resolveColor(ref: string): Color {
      const val = resolveVal(ref)
      if (val === undefined) return parseColor(ref)
      if (typeof val === 'object' && 'r' in val) return val
      if (typeof val === 'string') return parseColor(val)
      return { ...BLACK }
    },
    resolveNumber(ref: string): number {
      const val = resolveVal(ref)
      return typeof val === 'number' ? val : 0
    },
    resolveString(ref: string): string {
      const val = resolveVal(ref)
      return typeof val === 'string' ? val : ''
    },
    setActiveTheme(themeKey: string, themeName: string) {
      const modeId = modeByThemeValue.get(`${themeKey}:${themeName}`)
      if (modeId) {
        activeModeId = modeId
        graph.activeMode.set(collectionId, modeId)
      }
    }
  }
}
