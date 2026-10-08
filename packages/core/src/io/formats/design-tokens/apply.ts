import { compact } from 'es-toolkit/array'
import { pick } from 'es-toolkit/object'
import { isEmptyObject, isEqual } from 'es-toolkit/predicate'

import {
  findInstanceAncestor,
  type CodeSyntaxPlatform,
  type SceneGraph,
  type SceneNode,
  type TokenExpression,
  type TokenUnit,
  type Variable,
  type VariableCollection,
  type VariableScope,
  type VariableValue
} from '@open-pencil/scene-graph'
import { copyEffects } from '@open-pencil/scene-graph/copy'
import { randomHex } from '@open-pencil/scene-graph/random'

import { reconcileVariableLayouts } from '#core/layout/variables'

import type { AliasTarget, PlannedCollection, PlannedVariable, TokenImportPlan } from './plan'
import type { PlannedStyle } from './plan-styles'

/** Token fields an import sets; `undefined` clears one. */
export interface ImportedTokenFields {
  unit?: TokenUnit
  scopes?: VariableScope[]
  codeSyntax?: Partial<Record<CodeSyntaxPlatform, string>>
  hiddenFromPublishing?: boolean
  description?: string
  expressions?: Record<string, TokenExpression>
}

/**
 * The changes an import makes, so the editor can make them undoable and a headless document can
 * make them directly. Each adds to or changes the document; none deletes.
 */
export interface TokenImportTarget {
  graph: SceneGraph
  addCollection(name: string): VariableCollection
  addMode(collectionId: string, name: string): string | undefined
  renameMode(collectionId: string, modeId: string, name: string): void
  setDefaultMode(collectionId: string, modeId: string): void
  setModeCondition(collectionId: string, modeId: string, condition: string): void
  setModeAttribute(collectionId: string, name: string): void
  addVariable(planned: PlannedVariable, collectionId: string): Variable
  setValue(variableId: string, modeId: string, value: VariableValue): void
  setTokenFields(variableId: string, fields: ImportedTokenFields): void
  addStyle(style: PlannedStyle, fields: Partial<SceneNode>): SceneNode
  updateNode(nodeId: string, changes: Partial<SceneNode>): void
  bindVariable(nodeId: string, field: string, variableId: string): void
}

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

function targetCollection(target: TokenImportTarget, planned: PlannedCollection): string {
  if (planned.target.kind === 'existing') return planned.target.collectionId
  return target.addCollection(planned.target.name).id
}

/** Mode ids by planned mode: matched ones, a new collection's first renamed, or new ones. */
function targetModes(
  target: TokenImportTarget,
  planned: PlannedCollection,
  collectionId: string
): string[] {
  const collection = target.graph.variableCollections.get(collectionId)
  let unclaimed = planned.target.kind === 'new' ? (collection?.defaultModeId ?? null) : null
  const modeIds = planned.modes.map((mode) => {
    if (mode.target.kind === 'existing') return mode.target.modeId
    if (unclaimed) {
      const modeId = unclaimed
      unclaimed = null
      target.renameMode(collectionId, modeId, mode.target.name)
      return modeId
    }
    return target.addMode(collectionId, mode.target.name) ?? ''
  })
  planned.modes.forEach((mode, index) => {
    if (mode.condition) target.setModeCondition(collectionId, modeIds[index], mode.condition)
  })
  if (planned.target.kind === 'new') {
    const defaultIndex = planned.modes.findIndex((mode) => mode.isDefault)
    if (defaultIndex > 0) target.setDefaultMode(collectionId, modeIds[defaultIndex])
    if (planned.modeAttribute) target.setModeAttribute(collectionId, planned.modeAttribute)
  }
  return modeIds
}

function aliasId(target: AliasTarget, created: ReadonlyArray<ReadonlyArray<Variable>>) {
  if (target.kind === 'variable') return target.variableId
  return created.at(target.collection)?.at(target.variable)?.id
}

function plannedValue(
  value: NonNullable<PlannedVariable['values'][number]>,
  created: ReadonlyArray<ReadonlyArray<Variable>>
): VariableValue | undefined {
  if (value.kind === 'literal') return value.value
  const id = aliasId(value.target, created)
  return id ? { aliasId: id } : undefined
}

function applyVariables(target: TokenImportTarget, plan: TokenImportPlan) {
  const collectionIds = plan.collections.map((planned) => targetCollection(target, planned))
  const modeIds = plan.collections.map((planned, index) =>
    targetModes(target, planned, collectionIds[index])
  )
  // Every variable exists before any value is set, so aliases can point at later ones.
  const created = plan.collections.map((planned, index) =>
    planned.variables.map((variable) =>
      variable.existingId
        ? (target.graph.variables.get(variable.existingId) ??
          target.addVariable(variable, collectionIds[index]))
        : target.addVariable(variable, collectionIds[index])
    )
  )
  plan.collections.forEach((planned, collectionIndex) => {
    planned.variables.forEach((variable, variableIndex) => {
      const made = created[collectionIndex][variableIndex]
      const modes = modeIds[collectionIndex]
      variable.values.forEach((value, modeIndex) => {
        const next = value && plannedValue(value, created)
        const modeId = modes[modeIndex]
        if (next !== undefined && modeId && !isEqual(made.valuesByMode[modeId], next))
          target.setValue(made.id, modeId, next)
      })
      const expressions = Object.fromEntries(
        variable.expressions.flatMap((css, modeIndex) => {
          const resolved = made.valuesByMode[modes[modeIndex]]
          return css && typeof resolved === 'number' ? [[modes[modeIndex], { css, resolved }]] : []
        })
      )
      const fields: ImportedTokenFields = {
        unit: variable.unit,
        scopes: variable.scopes,
        codeSyntax: variable.codeSyntax,
        hiddenFromPublishing: variable.hiddenFromPublishing ?? false,
        description: variable.description ?? made.description
      }
      if (Object.keys(expressions).length > 0) fields.expressions = expressions
      target.setTokenFields(made.id, fields)
    })
  })
  return { collectionIds, created }
}

/** The fields a style gives each layer that uses it, with the reference that keeps it attached. */
function consumerPatch(style: SceneNode, kind: PlannedStyle['kind']): Partial<SceneNode> {
  if (kind === 'EFFECT')
    return { effects: copyEffects(style.effects), effectStyleId: style.source.id }
  const fields: Partial<SceneNode> = { textStyleId: style.source.id }
  for (const field of TEXT_STYLE_FIELDS) Object.assign(fields, { [field]: style[field] })
  return fields
}

/** The fields of `changes` that differ from what `node` holds, or null when none do. */
function changedFields(node: SceneNode, changes: Partial<SceneNode>): Partial<SceneNode> | null {
  const changed = Object.fromEntries(
    Object.entries(changes).filter(([key, value]) => !isEqual(node[key as keyof SceneNode], value))
  )
  return isEmptyObject(changed) ? null : changed
}

/**
 * Layers that use a style and hold its values themselves. Layers inside an instance follow their
 * component instead, and changing them would make overrides of what should stay inherited.
 */
function refKeyOf(kind: PlannedStyle['kind']) {
  return kind === 'TEXT' ? ('textStyleId' as const) : ('effectStyleId' as const)
}

function styleConsumers(graph: SceneGraph, style: SceneNode, kind: PlannedStyle['kind']) {
  const refKey = refKeyOf(kind)
  return [...graph.getAllNodes()].filter(
    (node) =>
      node[refKey] === style.source.id &&
      node.id !== style.id &&
      !findInstanceAncestor(graph, node.id)
  )
}

function applyStyles(
  target: TokenImportTarget,
  plan: TokenImportPlan,
  created: ReadonlyArray<ReadonlyArray<Variable>>
): string[] {
  return plan.styles.map((style) => {
    const existing = style.existingNodeId ? target.graph.getNode(style.existingNodeId) : undefined
    const node = existing ?? target.addStyle(style, { ...style.fields, name: style.name })
    const own = existing && changedFields(existing, style.fields)
    if (own) target.updateNode(node.id, own)
    for (const [field, alias] of Object.entries(style.bindings)) {
      const variableId = aliasId(alias, created)
      if (variableId && node.boundVariables[field] !== variableId)
        target.bindVariable(node.id, field, variableId)
    }
    if (own && node.source.id) {
      const patch = consumerPatch(node, style.kind)
      for (const consumer of styleConsumers(target.graph, node, style.kind)) {
        const changes = changedFields(consumer, patch)
        // The style reference always goes along, or changing styled fields would detach it.
        if (changes)
          target.updateNode(consumer.id, { ...changes, ...pick(patch, [refKeyOf(style.kind)]) })
      }
    }
    return node.id
  })
}

/**
 * Applies an import plan: collections and modes first, then every variable, then their values,
 * so an alias can point at a variable the same import adds, and last the styles, whose bindings
 * and the layers that use them follow. Nothing is deleted.
 */
export function applyTokenImport(
  target: TokenImportTarget,
  plan: TokenImportPlan
): TokenImportResult {
  const { collectionIds, created } = applyVariables(target, plan)
  const styleNodeIds = applyStyles(target, plan, created)
  return {
    collectionIds,
    variableIds: compact(created.flat().map((variable) => variable.id)),
    styleNodeIds
  }
}

/** A style node: hidden from the layer list, found by its style id, as `.fig` styles are. */
export function styleNodeProps(
  style: PlannedStyle,
  fields: Partial<SceneNode>
): Partial<SceneNode> {
  return { ...fields, sharedStyleType: style.kind, internalOnly: true }
}

export function styleNodeType(style: PlannedStyle) {
  return style.kind === 'TEXT' ? ('TEXT' as const) : ('RECTANGLE' as const)
}

/** The changes made directly on a graph, without history. */
function graphTokenImportTarget(
  graph: SceneGraph,
  pageId: string,
  changed: Set<string>
): TokenImportTarget {
  const collection = (id: string) => graph.variableCollections.get(id)
  return {
    graph,
    addCollection: (name) => graph.createCollection(name),
    addMode: (collectionId, name) => graph.createMode(collectionId, name),
    renameMode: (collectionId, modeId, name) => graph.renameMode(collectionId, modeId, name),
    setDefaultMode: (collectionId, modeId) => graph.setDefaultMode(collectionId, modeId),
    setModeCondition: (collectionId, modeId, condition) => {
      const mode = collection(collectionId)?.modes.find((entry) => entry.modeId === modeId)
      if (mode) mode.condition = condition
    },
    setModeAttribute: (collectionId, name) => {
      const found = collection(collectionId)
      if (found) found.modeAttribute = name
    },
    addVariable: (planned, collectionId) =>
      graph.createVariable(planned.name, planned.type, collectionId),
    setValue: (variableId, modeId, value) => {
      const variable = graph.variables.get(variableId)
      if (!variable) return
      variable.valuesByMode[modeId] = structuredClone(value)
      changed.add(variableId)
    },
    setTokenFields: (variableId, fields) => {
      const variable = graph.variables.get(variableId)
      if (!variable) return
      for (const [key, value] of Object.entries(fields))
        if (value === undefined) Reflect.deleteProperty(variable, key)
        else Object.assign(variable, { [key]: structuredClone(value) })
    },
    addStyle: (style, fields) => {
      const node = graph.createNode(styleNodeType(style), pageId, styleNodeProps(style, fields))
      node.source.id = `style:${randomHex(12)}`
      return node
    },
    updateNode: (nodeId, changes) => graph.updateNode(nodeId, changes),
    bindVariable: (nodeId, field, variableId) => graph.bindVariable(nodeId, field, variableId)
  }
}

/**
 * Imports straight into a graph, for scripts, tools, and the CLI working on a document without
 * an editor; the layers bound to variables whose values changed are resolved and laid out
 * afterwards.
 */
export function importTokensIntoGraph(
  graph: SceneGraph,
  pageId: string,
  plan: TokenImportPlan
): TokenImportResult {
  const changed = new Set<string>()
  const result = applyTokenImport(graphTokenImportTarget(graph, pageId, changed), plan)
  if (changed.size > 0) reconcileVariableLayouts(graph, { variables: changed })
  return result
}
