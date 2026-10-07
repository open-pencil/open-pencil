import { compact } from 'es-toolkit/array'

import type { SceneNode, Variable, VariableValue } from '@open-pencil/scene-graph'
import { copyEffects } from '@open-pencil/scene-graph/copy'

import type {
  AliasTarget,
  PlannedCollection,
  PlannedStyle,
  PlannedVariable,
  TokenImportPlan
} from '#core/io/formats/design-tokens'

import type { createNodeActions } from './nodes'
import type { EditorContext } from './types'
import type { createVariableActions } from './variables'

type VariableActions = ReturnType<typeof createVariableActions>
type NodeActions = ReturnType<typeof createNodeActions>

export interface TokenImportResult {
  collectionIds: string[]
  variableIds: string[]
  styleNodeIds: string[]
}

/** Text fields a text style gives the layers that use it. */
const TEXT_STYLE_FIELDS = [
  'fontFamily',
  'fontWeight',
  'italic',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase'
] as const satisfies ReadonlyArray<keyof SceneNode>

export function createDesignTokenActions(
  ctx: EditorContext,
  variables: VariableActions,
  nodes: NodeActions
) {
  /** A collection to import into: the existing one, or a new one whose first mode is renamed. */
  function targetCollection(planned: PlannedCollection): string {
    if (planned.target.kind === 'existing') return planned.target.collectionId
    const collection = ctx.graph.createCollection(planned.target.name)
    variables.addCollection(collection)
    return collection.id
  }

  /** Mode ids by planned mode: matched ones, the new collection's first, or new ones. */
  function targetModes(planned: PlannedCollection, collectionId: string): string[] {
    const collection = ctx.graph.variableCollections.get(collectionId)
    let unclaimedDefault =
      planned.target.kind === 'new' ? (collection?.defaultModeId ?? null) : null
    const modeIds = planned.modes.map((mode) => {
      if (mode.target.kind === 'existing') return mode.target.modeId
      if (unclaimedDefault) {
        const modeId = unclaimedDefault
        unclaimedDefault = null
        variables.renameMode(collectionId, modeId, mode.target.name)
        return modeId
      }
      return variables.addMode(collectionId, mode.target.name) ?? ''
    })
    planned.modes.forEach((mode, index) => {
      if (mode.condition) variables.setModeCondition(collectionId, modeIds[index], mode.condition)
    })
    if (planned.target.kind === 'new') {
      const defaultIndex = planned.modes.findIndex((mode) => mode.isDefault)
      if (defaultIndex > 0) variables.setDefaultMode(collectionId, modeIds[defaultIndex])
      if (planned.modeAttribute) variables.setModeAttribute(collectionId, planned.modeAttribute)
    }
    return modeIds
  }

  /** The variable a planned one becomes: the existing one, or a new one added to the collection. */
  function targetVariable(planned: PlannedVariable, collectionId: string): Variable {
    const existing = planned.existingId ? ctx.graph.variables.get(planned.existingId) : undefined
    if (existing) return existing
    const variable = ctx.graph.createVariable(planned.name, planned.type, collectionId)
    variables.addVariable(variable)
    return variable
  }

  function aliasId(
    target: AliasTarget,
    created: ReadonlyArray<ReadonlyArray<Variable>>
  ): string | undefined {
    if (target.kind === 'variable') return target.variableId
    return created[target.collection]?.[target.variable]?.id
  }

  function applyVariables(plan: TokenImportPlan) {
    const collectionIds = plan.collections.map(targetCollection)
    const modeIds = plan.collections.map((planned, index) =>
      targetModes(planned, collectionIds[index])
    )
    // Every variable exists before any value is set, so aliases can point at later ones.
    const created = plan.collections.map((planned, index) =>
      planned.variables.map((variable) => targetVariable(variable, collectionIds[index]))
    )
    plan.collections.forEach((planned, collectionIndex) => {
      planned.variables.forEach((variable, variableIndex) => {
        const target = created[collectionIndex][variableIndex]
        variable.values.forEach((value, modeIndex) => {
          const modeId = modeIds[collectionIndex][modeIndex]
          if (!value || !modeId) return
          const next: VariableValue | undefined =
            value.kind === 'literal'
              ? value.value
              : (() => {
                  const id = aliasId(value.target, created)
                  return id ? { aliasId: id } : undefined
                })()
          if (next !== undefined) variables.updateVariableValue(target.id, modeId, next)
        })
        const expressions = Object.fromEntries(
          variable.expressions.flatMap((css, modeIndex) => {
            const modeId = modeIds[collectionIndex][modeIndex]
            const resolved = target.valuesByMode[modeId]
            return css && typeof resolved === 'number' ? [[modeId, { css, resolved }]] : []
          })
        )
        variables.updateVariableToken(target.id, {
          unit: variable.unit,
          scopes: variable.scopes,
          codeSyntax: variable.codeSyntax,
          hiddenFromPublishing: variable.hiddenFromPublishing ?? false,
          description: variable.description ?? target.description,
          ...(Object.keys(expressions).length > 0 ? { expressions } : {})
        })
      })
    })
    return { collectionIds, created }
  }

  /** A new style node, which redo makes again with the same ids so layers stay attached. */
  function createStyle(style: PlannedStyle): SceneNode {
    const node = ctx.graph.createNode(
      style.kind === 'TEXT' ? 'TEXT' : 'RECTANGLE',
      ctx.state.currentPageId,
      {
        ...style.fields,
        name: style.name,
        sharedStyleType: style.kind,
        internalOnly: true
      }
    )
    node.source.id = crypto.randomUUID()
    const snapshot = structuredClone(node)
    const parentId = node.parentId
    ctx.undo.push({
      label: 'Add style',
      forward: () => {
        ctx.graph.createNodeWithId(snapshot.id, snapshot.type, parentId, structuredClone(snapshot))
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.deleteNode(snapshot.id)
        ctx.requestRender()
      }
    })
    return node
  }

  /** The fields a style gives each layer that uses it, which keep their style attached. */
  function consumerPatch(style: SceneNode, kind: PlannedStyle['kind']): Partial<SceneNode> {
    const styleId = style.source.id
    if (kind === 'EFFECT') return { effects: copyEffects(style.effects), effectStyleId: styleId }
    const fields: Partial<SceneNode> = { textStyleId: styleId }
    for (const field of TEXT_STYLE_FIELDS) Object.assign(fields, { [field]: style[field] })
    return fields
  }

  function applyStyles(plan: TokenImportPlan, created: ReadonlyArray<ReadonlyArray<Variable>>) {
    return plan.styles.map((style) => {
      const existing = style.existingNodeId ? ctx.graph.getNode(style.existingNodeId) : undefined
      const node = existing ?? createStyle(style)
      if (existing) nodes.updateNodeWithUndo(existing.id, style.fields, 'Update style')
      for (const [field, target] of Object.entries(style.bindings)) {
        const variableId = aliasId(target, created)
        if (variableId) nodes.bindVariable(node.id, field, variableId)
      }
      if (existing && node.source.id) {
        const refKey = style.kind === 'TEXT' ? 'textStyleId' : 'effectStyleId'
        const consumers = [...ctx.graph.getAllNodes()].filter(
          (candidate) => candidate[refKey] === node.source.id && candidate.id !== node.id
        )
        const patch = consumerPatch(node, style.kind)
        for (const consumer of consumers)
          nodes.updateNodeWithUndo(consumer.id, patch, 'Update style')
      }
      return node.id
    })
  }

  /**
   * Applies an import plan as one undo step: collections and modes first, then every variable,
   * then their values, so an alias can point at a variable the same import adds, and last the
   * styles, whose bindings and users follow. Nothing is deleted.
   */
  function importDesignTokens(plan: TokenImportPlan): TokenImportResult {
    return ctx.undo.runBatch('Import design tokens', () => {
      const { collectionIds, created } = applyVariables(plan)
      const styleNodeIds = applyStyles(plan, created)
      ctx.requestRender()
      return {
        collectionIds,
        variableIds: compact(created.flat().map((variable) => variable.id)),
        styleNodeIds
      }
    })
  }

  return { importDesignTokens }
}
