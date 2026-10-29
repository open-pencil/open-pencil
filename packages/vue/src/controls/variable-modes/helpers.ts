import { omit } from 'es-toolkit'

import type { Editor } from '@open-pencil/core'
import {
  isLibraryCollection,
  type SceneNode,
  type VariableCollection,
  type VariableCollectionMode
} from '@open-pencil/scene-graph'
import { collectionsBoundIn } from '@open-pencil/scene-graph/variables'

import { MIXED, type MixedValue } from '#vue/controls/node-props/use'

/** A mode as the control lists it. */
export type VariableModeOption = Pick<VariableCollectionMode, 'modeId' | 'name'>

/** One collection a variable mode can be set for, as Figma's Apply variable mode menu lists it. */
export interface VariableModeChoice {
  collectionId: string
  name: string
  /** Whether the collection is a library's copy rather than the file's own. */
  library: boolean
  modes: VariableModeOption[]
  /** The mode every target sets, MIXED when they differ, or null when none sets one (Auto). */
  value: MixedValue<string | null>
  /** The mode the targets show without one of their own, null when they would show different ones. */
  inherited: VariableModeOption | null
}

function modeOption(collection: VariableCollection, modeId: string): VariableModeOption | null {
  const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
  return mode ? { modeId: mode.modeId, name: mode.name } : null
}

function shared<T>(values: readonly T[]): MixedValue<T> {
  const [first] = values
  return values.every((value) => value === first) ? first : MIXED
}

/**
 * The collections a mode can be set for on `targets`, as Figma offers them: those with more than
 * one mode whose variables the targets' layers use, or every such collection for a page.
 */
export function variableModeChoices(editor: Editor, targets: SceneNode[]): VariableModeChoice[] {
  if (targets.length === 0) return []
  const { graph } = editor
  const page = targets.every((target) => target.type === 'CANVAS')
  const used = page
    ? null
    : collectionsBoundIn(
        graph,
        targets.map((target) => target.id)
      )
  const choices: VariableModeChoice[] = []
  for (const collection of graph.variableCollections.values()) {
    if (collection.modes.length < 2) continue
    if (used && !used.has(collection.id)) continue
    const inherited = shared(
      targets.map((target) =>
        target.parentId
          ? graph.getNodeVariableModeId(target.parentId, collection.id)
          : collection.defaultModeId
      )
    )
    choices.push({
      collectionId: collection.id,
      name: collection.name,
      library: isLibraryCollection(collection),
      modes: collection.modes.map((mode) => ({ modeId: mode.modeId, name: mode.name })),
      value: shared(targets.map((target) => target.variableModes[collection.id] ?? null)),
      inherited: inherited === MIXED ? null : modeOption(collection, inherited)
    })
  }
  return choices
}

/**
 * Sets the mode `targets` show for a collection, or clears it with null so they inherit their
 * parent's again, in one undo step.
 */
export function setVariableMode(
  editor: Editor,
  targets: SceneNode[],
  collectionId: string,
  modeId: string | null
): void {
  const changed = targets.filter(
    (target) => (target.variableModes[collectionId] ?? null) !== modeId
  )
  if (changed.length === 0) return
  const label = modeId ? 'Apply variable mode' : 'Remove variable mode'
  editor.undo.runBatch(label, () => {
    for (const target of changed) {
      const others = omit(target.variableModes, [collectionId])
      const variableModes = modeId ? { ...others, [collectionId]: modeId } : others
      editor.updateNodeWithUndo(target.id, { variableModes }, label)
    }
  })
}
