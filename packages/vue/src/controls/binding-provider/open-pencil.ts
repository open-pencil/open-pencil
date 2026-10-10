import { isEqual } from 'es-toolkit'
import { useFilter } from 'reka-ui'

import type { Editor } from '@open-pencil/core/editor'
import type { Variable, VariableType } from '@open-pencil/scene-graph'

import type {
  BindingValueEdit,
  BindingProvider,
  BindingState,
  BindingTarget
} from '#vue/controls/binding-provider/types'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

import { resolveEffectiveBindingValue } from './resolution'

export interface OpenPencilBindingProviderOptions<V> {
  type: VariableType
  resolve(editor: Editor, variableId: string, target?: BindingTarget): V | undefined
  create?(editor: Editor, target: BindingTarget, value: V, name: string): void
  prepareEdit?(
    editor: Editor,
    variableId: string,
    target: BindingTarget
  ): BindingValueEdit<V> | undefined
}

export function createOpenPencilBindingProvider<V>(
  editor: Editor,
  options: OpenPencilBindingProviderOptions<V>,
  revision?: BindingProvider<V>['revision']
): BindingProvider<V> {
  const { contains } = useFilter({ sensitivity: 'base' })
  const variables = () => editor.getVariablesByType(options.type)
  const interactiveEdits: Array<{ end: () => void; stopSettling: () => void }> = []

  /**
   * A picker keeps one batch open while it is used. Undo and redo commit it first and reopen it,
   * so they act on the picker's changes and later changes still form one step.
   */
  function beginBatch(label: string) {
    editor.undo.beginBatch(label)
    const stopSettling = editor.undo.onBeforeHistory(() => {
      editor.undo.commitBatch()
      editor.undo.beginBatch(label)
    })
    interactiveEdits.push({ end: editor.beginInteractiveEdit(), stopSettling })
  }

  function finishBatch(commit: boolean) {
    const edit = interactiveEdits.pop()
    edit?.stopSettling()
    try {
      if (commit) editor.undo.commitBatch()
      else editor.undo.rollbackBatch()
    } finally {
      edit?.end()
    }
  }

  function filterVariables(term: string): Variable[] {
    if (!term) return variables()
    return variables().filter((variable) => contains(variable.name, term))
  }

  function getBound(target: BindingTarget): Variable | undefined {
    void revision?.value
    const variableId = editor.getNode(target.nodeId)?.boundVariables[target.path]
    return variableId ? editor.getVariable(variableId) : undefined
  }

  function getState(targets: BindingTarget[]): BindingState {
    if (targets.length === 0) return 'unbound'
    const variableIds = new Set(
      targets.map(
        (target) => editor.getNode(target.nodeId)?.boundVariables[target.path] ?? undefined
      )
    )
    // Identity takes precedence: an explicit mixed edit can detach the selection.
    // edit-variable still requires every bound destination to prepare successfully.
    if (variableIds.size > 1) return 'mixed'
    const unresolved = targets.some((target) => {
      const id = editor.getNode(target.nodeId)?.boundVariables[target.path]
      return (
        id !== undefined &&
        (resolveEffectiveBindingValue(editor, id, target) === undefined ||
          options.resolve(editor, id, target) === undefined)
      )
    })
    if (unresolved) return 'unresolved'
    if (variableIds.has(undefined)) return 'unbound'
    const values = targets.map((target) => {
      const id = editor.getNode(target.nodeId)?.boundVariables[target.path]
      return id ? options.resolve(editor, id, target) : undefined
    })
    if (values.some((value) => value === undefined)) return 'unresolved'
    return values.every((value) => isEqual(value, values[0])) ? 'bound' : 'mixed'
  }

  return {
    revision,
    listVariables: variables,
    collectionName: (variable) => editor.getCollection(variable.collectionId)?.name,
    filterVariables,
    getBindingId: (target) => editor.getNode(target.nodeId)?.boundVariables[target.path],
    getBound,
    getState,
    resolve: (variableId, target) => options.resolve(editor, variableId, target),
    bind: (target, variableId) => editor.bindVariable(target.nodeId, target.path, variableId),
    unbind: (target) => editor.unbindVariable(target.nodeId, target.path),
    create: options.create
      ? (target, value, name) => options.create?.(editor, target, value, name)
      : undefined,
    prepareEdit: options.prepareEdit
      ? (variableId, target) => options.prepareEdit?.(editor, variableId, target)
      : undefined,
    runBatch: (label, action) => editor.undo.runBatch(label, action),
    beginBatch,
    commitBatch: () => finishBatch(true),
    rollbackBatch: () => finishBatch(false)
  }
}

export function useOpenPencilBindingProvider<V>(
  options: OpenPencilBindingProviderOptions<V>
): BindingProvider<V> {
  const editor = useEditor()
  const revision = useSceneComputed(() => editor.state.sceneVersion)
  return createOpenPencilBindingProvider(editor, options, revision)
}
