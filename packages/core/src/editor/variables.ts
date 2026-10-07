import { omit, omitBy } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import {
  isModeAttributeName,
  type BindingScope,
  type TokenExpression,
  type Variable,
  type VariableCollection,
  type VariableType,
  type VariableValue
} from '@open-pencil/scene-graph'

import { reconcileVariableLayouts } from '#core/layout/variables'

import type { EditorContext } from './types'

/** What a variable means as a design token beyond its values: how CSS and code read it. */
export type VariableTokenFields = Pick<
  Variable,
  'unit' | 'expressions' | 'scopes' | 'codeSyntax' | 'description' | 'hiddenFromPublishing'
>

/** Every token field, unset ones included, so restoring it also clears what was added. */
function tokenFields(variable: Variable): VariableTokenFields {
  const { unit, expressions, scopes, codeSyntax, description, hiddenFromPublishing } = variable
  return structuredClone({
    unit,
    expressions,
    scopes,
    codeSyntax,
    description,
    hiddenFromPublishing
  })
}

/** A mode's value with the CSS expression written for it, which the value must keep matching. */
interface ModeEntry {
  value: VariableValue | undefined
  expression: TokenExpression | undefined
}

function modeEntry(variable: Variable, modeId: string): ModeEntry {
  return structuredClone({
    value: variable.valuesByMode[modeId],
    expression: variable.expressions?.[modeId]
  })
}

function setModeEntry(variable: Variable, modeId: string, entry: ModeEntry) {
  const { value, expression } = structuredClone(entry)
  const values = omit(variable.valuesByMode, [modeId])
  variable.valuesByMode = value === undefined ? values : { ...values, [modeId]: value }
  const others = omit(variable.expressions ?? {}, [modeId])
  const expressions: Record<string, TokenExpression> = expression
    ? { ...others, [modeId]: expression }
    : others
  if (isEmptyObject(expressions)) delete variable.expressions
  else variable.expressions = expressions
}

export function createVariableActions(ctx: EditorContext) {
  /**
   * Re-resolves the layers a change to what variables resolve to can reach: those bound to the
   * changed variables or to variables aliasing them. Every other variable change, such as adding,
   * renaming, reordering, or a token field, changes nothing the canvas draws, so it only refreshes
   * the views and leaves the canvas's recorded pictures in place.
   */
  function refreshVariables(scope: BindingScope) {
    reconcileVariableLayouts(ctx.graph, scope)
    ctx.requestRender()
  }

  /** Every variable in a collection, the ones a change to its modes can reach. */
  function collectionScope(collectionId: string): BindingScope {
    return { variables: [...(ctx.graph.variableCollections.get(collectionId)?.variableIds ?? [])] }
  }

  function getVariablesByType(type: VariableType) {
    return ctx.graph.getVariablesByType(type)
  }

  function getVariable(id: string) {
    return ctx.graph.variables.get(id)
  }

  function resolveColorVariable(id: string) {
    return ctx.graph.resolveColorVariable(id)
  }

  function resolveNumberVariable(id: string) {
    return ctx.graph.resolveNumberVariable(id)
  }

  function getVariablesForCollection(collectionId: string) {
    return ctx.graph.getVariablesForCollection(collectionId)
  }

  function getCollection(id: string) {
    return ctx.graph.variableCollections.get(id)
  }

  function getCollections() {
    return [...ctx.graph.variableCollections.values()]
  }

  function getCollectionCount() {
    return ctx.graph.variableCollections.size
  }

  function getVariableCount() {
    return ctx.graph.variables.size
  }

  function renameCollection(id: string, newName: string) {
    const collection = ctx.graph.variableCollections.get(id)
    if (!collection) return
    const prevName = collection.name
    collection.name = newName
    ctx.undo.push({
      label: 'Rename collection',
      forward: () => {
        const c = ctx.graph.variableCollections.get(id)
        if (c) c.name = newName
        ctx.requestRefresh()
      },
      inverse: () => {
        const c = ctx.graph.variableCollections.get(id)
        if (c) c.name = prevName
        ctx.requestRefresh()
      }
    })
    ctx.requestRefresh()
  }

  function addCollection(collection: VariableCollection) {
    ctx.graph.addCollection(collection)
    ctx.undo.push({
      label: 'Add collection',
      forward: () => {
        ctx.graph.addCollection(collection)
        ctx.requestRefresh()
      },
      inverse: () => {
        ctx.graph.removeCollection(collection.id)
        ctx.requestRefresh()
      }
    })
    ctx.requestRefresh()
  }

  function removeCollection(id: string) {
    const collection = ctx.graph.variableCollections.get(id)
    if (!collection) return
    const snapshot = structuredClone(collection)
    const scope: BindingScope = { variables: snapshot.variableIds }
    const variables = snapshot.variableIds
      .map((vid) => ctx.graph.variables.get(vid))
      .filter((v): v is Variable => v != null)
      .map((v) => structuredClone(v))
    ctx.graph.removeCollection(id)
    ctx.undo.push({
      label: 'Remove collection',
      forward: () => {
        ctx.graph.removeCollection(id)
        refreshVariables(scope)
      },
      inverse: () => {
        ctx.graph.addCollection(snapshot)
        for (const v of variables) ctx.graph.addVariable(v)
        refreshVariables(scope)
      }
    })
    refreshVariables(scope)
  }

  function addVariable(variable: Variable) {
    ctx.graph.addVariable(variable)
    ctx.undo.push({
      label: 'Add variable',
      forward: () => {
        ctx.graph.addVariable(variable)
        ctx.requestRefresh()
      },
      inverse: () => {
        ctx.graph.removeVariable(variable.id)
        ctx.requestRefresh()
      }
    })
    ctx.requestRefresh()
  }

  function removeVariable(id: string) {
    const variable = ctx.graph.variables.get(id)
    if (!variable) return
    const snapshot = structuredClone(variable)
    const order = [...(ctx.graph.variableCollections.get(variable.collectionId)?.variableIds ?? [])]
    ctx.graph.removeVariable(id)
    ctx.undo.push({
      label: 'Remove variable',
      forward: () => {
        ctx.graph.removeVariable(id)
        refreshVariables({ variables: [id] })
      },
      // Undo puts the variable back where it was, not at the end of its collection.
      inverse: () => {
        ctx.graph.addVariable(structuredClone(snapshot))
        placeVariables(snapshot.collectionId, order)
        refreshVariables({ variables: [id] })
      }
    })
    refreshVariables({ variables: [id] })
  }

  /** Puts a collection's variables in `order`; ids it does not hold are ignored. */
  function placeVariables(collectionId: string, order: readonly string[]) {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection) return
    const held = new Set(collection.variableIds)
    const placed = order.filter((id) => held.has(id))
    const rest = collection.variableIds.filter((id) => !placed.includes(id))
    collection.variableIds = [...placed, ...rest]
  }

  /** Reorders a collection's variables in one undo step; the order is what files and lists show. */
  function setVariableOrder(collectionId: string, order: readonly string[]) {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection) return
    const previous = [...collection.variableIds]
    const next = [...order]
    placeVariables(collectionId, next)
    if (previous.join('\n') === collection.variableIds.join('\n')) return
    ctx.undo.push({
      label: 'Reorder variables',
      forward: () => {
        placeVariables(collectionId, next)
        ctx.requestRefresh()
      },
      inverse: () => {
        placeVariables(collectionId, previous)
        ctx.requestRefresh()
      }
    })
    ctx.requestRefresh()
  }

  /** Copies a variable, values and token fields included, right after the original. */
  function duplicateVariable(id: string, name: string): string | undefined {
    const source = ctx.graph.variables.get(id)
    const collection = source && ctx.graph.variableCollections.get(source.collectionId)
    if (!source || !collection) return undefined
    const created = ctx.graph.createVariable(name, source.type, source.collectionId)
    const copy: Variable = { ...structuredClone(source), id: created.id, name }
    ctx.graph.addVariable(copy)
    const before = [...collection.variableIds]
    const order = before.filter((candidate) => candidate !== copy.id)
    order.splice(order.indexOf(id) + 1, 0, copy.id)
    placeVariables(collection.id, order)
    ctx.undo.push({
      label: 'Duplicate variable',
      forward: () => {
        ctx.graph.addVariable(structuredClone(copy))
        placeVariables(collection.id, order)
        ctx.requestRefresh()
      },
      inverse: () => {
        ctx.graph.removeVariable(copy.id)
        ctx.requestRefresh()
      }
    })
    ctx.requestRefresh()
    return copy.id
  }

  function renameVariable(id: string, newName: string) {
    const variable = ctx.graph.variables.get(id)
    if (!variable) return
    const prevName = variable.name
    variable.name = newName
    ctx.undo.push({
      label: 'Rename variable',
      forward: () => {
        const v = ctx.graph.variables.get(id)
        if (v) v.name = newName
        ctx.requestRefresh()
      },
      inverse: () => {
        const v = ctx.graph.variables.get(id)
        if (v) v.name = prevName
        ctx.requestRefresh()
      }
    })
    ctx.requestRefresh()
  }

  function addMode(collectionId: string, name?: string): string | undefined {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection) return undefined
    const modeName = name ?? `Mode ${collection.modes.length + 1}`
    const modeId = ctx.graph.createMode(collectionId, modeName)
    if (!modeId) return undefined
    ctx.undo.push({
      label: 'Add mode',
      forward: () => {
        ctx.graph.addMode(collectionId, modeId, modeName)
        refreshVariables(collectionScope(collectionId))
      },
      inverse: () => {
        ctx.graph.removeMode(collectionId, modeId)
        refreshVariables(collectionScope(collectionId))
      }
    })
    refreshVariables(collectionScope(collectionId))
    return modeId
  }

  function removeMode(collectionId: string, modeId: string) {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection || collection.modes.length <= 1) return
    const modeIndex = collection.modes.findIndex((m) => m.modeId === modeId)
    const modeName = collection.modes[modeIndex]?.name ?? ''
    const wasDefault = collection.defaultModeId === modeId
    const valueSnapshots = new Map<string, VariableValue>()
    for (const varId of collection.variableIds) {
      const v = ctx.graph.variables.get(varId)
      if (v?.valuesByMode[modeId] !== undefined) {
        valueSnapshots.set(varId, structuredClone(v.valuesByMode[modeId]))
      }
    }
    ctx.graph.removeMode(collectionId, modeId)
    ctx.undo.push({
      label: 'Remove mode',
      forward: () => {
        ctx.graph.removeMode(collectionId, modeId)
        refreshVariables(collectionScope(collectionId))
      },
      inverse: () => {
        ctx.graph.addMode(collectionId, modeId, modeName)
        const col = ctx.graph.variableCollections.get(collectionId)
        if (col && modeIndex !== -1) {
          const mode = col.modes.pop()
          if (mode) col.modes.splice(modeIndex, 0, mode)
        }
        for (const [varId, value] of valueSnapshots) {
          const v = ctx.graph.variables.get(varId)
          if (v) v.valuesByMode[modeId] = structuredClone(value)
        }
        if (wasDefault) ctx.graph.setDefaultMode(collectionId, modeId)
        refreshVariables(collectionScope(collectionId))
      }
    })
    refreshVariables(collectionScope(collectionId))
  }

  function renameMode(collectionId: string, modeId: string, newName: string) {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection) return
    const mode = collection.modes.find((m) => m.modeId === modeId)
    if (!mode) return
    const prevName = mode.name
    ctx.graph.renameMode(collectionId, modeId, newName)
    ctx.undo.push({
      label: 'Rename mode',
      forward: () => {
        ctx.graph.renameMode(collectionId, modeId, newName)
        ctx.requestRefresh()
      },
      inverse: () => {
        ctx.graph.renameMode(collectionId, modeId, prevName)
        ctx.requestRefresh()
      }
    })
    ctx.requestRefresh()
  }

  function setDefaultMode(collectionId: string, modeId: string) {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection) return
    const prevDefault = collection.defaultModeId
    const prevModes = structuredClone(collection.modes)
    ctx.graph.setDefaultMode(collectionId, modeId)
    ctx.undo.push({
      label: 'Set default mode',
      forward: () => {
        ctx.graph.setDefaultMode(collectionId, modeId)
        refreshVariables(collectionScope(collectionId))
      },
      inverse: () => {
        // Setting a default moves it first; undo restores the column order too. Look the
        // collection up again: undoing its removal in between restores a copy.
        const current = ctx.graph.variableCollections.get(collectionId)
        if (current) {
          current.modes = structuredClone(prevModes)
          current.defaultModeId = prevDefault
        }
        refreshVariables(collectionScope(collectionId))
      }
    })
    refreshVariables(collectionScope(collectionId))
  }

  function duplicateMode(collectionId: string, sourceModeId: string): string | undefined {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection) return undefined
    const sourceMode = collection.modes.find((m) => m.modeId === sourceModeId)
    if (!sourceMode) return undefined
    const modeName = `${sourceMode.name} copy`
    const modeId = ctx.graph.createMode(collectionId, modeName, sourceModeId)
    if (!modeId) return undefined
    ctx.undo.push({
      label: 'Duplicate mode',
      forward: () => {
        ctx.graph.addMode(collectionId, modeId, modeName, sourceModeId)
        refreshVariables(collectionScope(collectionId))
      },
      inverse: () => {
        ctx.graph.removeMode(collectionId, modeId)
        refreshVariables(collectionScope(collectionId))
      }
    })
    refreshVariables(collectionScope(collectionId))
    return modeId
  }

  function setActiveMode(collectionId: string, modeId: string) {
    ctx.graph.setActiveMode(collectionId, modeId)
    refreshVariables(collectionScope(collectionId))
  }

  /**
   * Sets one mode's value. Calls that share a `coalesceKey`, such as the steps of one color picker
   * drag, undo together.
   */
  function updateVariableValue(
    id: string,
    modeId: string,
    value: VariableValue,
    coalesceKey?: string
  ) {
    const variable = ctx.graph.variables.get(id)
    if (!variable) return
    const previous = modeEntry(variable, modeId)
    // A number keeps its expression, which records the number it stands for; anything else drops it.
    const expression = previous.expression
    const next: ModeEntry = {
      value: structuredClone(value),
      expression:
        typeof value === 'number' && expression ? { ...expression, resolved: value } : undefined
    }
    const apply = (entry: ModeEntry) => {
      const target = ctx.graph.variables.get(id)
      if (target) setModeEntry(target, modeId, entry)
      refreshVariables({ variables: [id] })
    }
    apply(next)
    ctx.undo.push({
      label: 'Update variable value',
      forward: () => apply(next),
      inverse: () => apply(previous),
      coalesceKey
    })
  }

  /** Change token fields in one undo step; a field set to `undefined` is cleared. */
  function updateVariableToken(id: string, patch: Partial<VariableTokenFields>) {
    const variable = ctx.graph.variables.get(id)
    if (!variable) return
    const previous = tokenFields(variable)
    const next = structuredClone(patch)
    const apply = (values: Partial<VariableTokenFields>) => {
      const target = ctx.graph.variables.get(id)
      if (!target) return
      const { description, ...fields } = structuredClone(values)
      // A cleared field is removed, not kept as a key set to `undefined`.
      for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
        if (fields[key] === undefined) Reflect.deleteProperty(target, key)
      }
      Object.assign(
        target,
        omitBy(fields, (value) => value === undefined)
      )
      // Every variable has a description; clearing it leaves an empty one.
      if ('description' in values) target.description = description ?? ''
      ctx.requestRefresh()
    }
    apply(next)
    ctx.undo.push({
      label: 'Update variable token',
      forward: () => apply(next),
      inverse: () => apply(previous)
    })
  }

  /** The selector or query a mode applies under; an empty condition restores the default. */
  function setModeCondition(collectionId: string, modeId: string, condition: string | undefined) {
    const mode = ctx.graph.variableCollections
      .get(collectionId)
      ?.modes.find((candidate) => candidate.modeId === modeId)
    if (!mode) return
    const previous = mode.condition
    const next = condition?.trim() || undefined
    if (next === previous) return
    const apply = (value: string | undefined) => {
      const target = ctx.graph.variableCollections
        .get(collectionId)
        ?.modes.find((candidate) => candidate.modeId === modeId)
      if (target) target.condition = value
      ctx.requestRefresh()
    }
    apply(next)
    ctx.undo.push({
      label: 'Set mode condition',
      forward: () => apply(next),
      inverse: () => apply(previous)
    })
  }

  /**
   * Name the attribute manual modes are switched by; an empty name restores the default, and a
   * name no stylesheet can select on leaves the current one.
   */
  function setModeAttribute(collectionId: string, name: string | undefined) {
    const collection = ctx.graph.variableCollections.get(collectionId)
    if (!collection) return
    const previous = collection.modeAttribute
    const next = name?.trim() || undefined
    if (next === previous || (next !== undefined && !isModeAttributeName(next))) return
    const apply = (value: string | undefined) => {
      const target = ctx.graph.variableCollections.get(collectionId)
      if (target) target.modeAttribute = value
      ctx.requestRefresh()
    }
    apply(next)
    ctx.undo.push({
      label: 'Set mode attribute',
      forward: () => apply(next),
      inverse: () => apply(previous)
    })
  }

  return {
    updateVariableToken,
    setModeCondition,
    duplicateVariable,
    setVariableOrder,
    setModeAttribute,
    getVariablesByType,
    getVariable,
    resolveColorVariable,
    resolveNumberVariable,
    getVariablesForCollection,
    getCollection,
    getCollections,
    getCollectionCount,
    getVariableCount,
    renameCollection,
    addCollection,
    removeCollection,
    addVariable,
    removeVariable,
    renameVariable,
    updateVariableValue,
    addMode,
    removeMode,
    renameMode,
    setDefaultMode,
    duplicateMode,
    setActiveMode
  }
}
