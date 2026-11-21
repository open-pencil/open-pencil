import {
  defaultTokenImportOptions,
  type CollectionImportChoice,
  type DesignTokenBundle,
  type ModeCopy,
  type TokenImportOptions
} from '@open-pencil/core/io/formats/design-tokens'
import type { SceneGraph, VariableCollection } from '@open-pencil/scene-graph'
import { DARK_MODE_CONDITION, THEME_MODE_NAMES } from '@open-pencil/vue/variables'

type ModeWrite = ModeCopy['target']

/** A mode of the collection by name, or a new one of that name. */
function modeNamed(name: string, collection: VariableCollection | undefined): ModeWrite {
  const match = collection?.modes.find((mode) => mode.name === name)
  return match ? { kind: 'existing', modeId: match.modeId } : { kind: 'new', name }
}

/** The collection a choice writes into, when it is one the document has. */
export function choiceCollection(
  graph: SceneGraph,
  choice: CollectionImportChoice
): VariableCollection | undefined {
  return choice.target.kind === 'existing'
    ? graph.variableCollections.get(choice.target.collectionId)
    : undefined
}

/**
 * Dark applies under the `dark` class when it is new or says nowhere of its own; a Dark the
 * collection already places, such as under a media query, keeps its place.
 */
function darkCondition(
  target: ModeWrite,
  collection: VariableCollection | undefined
): string | undefined {
  if (target.kind === 'new') return DARK_MODE_CONDITION
  const mode = collection?.modes.find((candidate) => candidate.modeId === target.modeId)
  return mode?.condition ? undefined : DARK_MODE_CONDITION
}

/** Whether a bundle mode is written into Light and Dark. */
export function writesLightAndDark(choice: CollectionImportChoice, from: number): boolean {
  return (choice.copies ?? []).some((copy) => copy.from === from)
}

/** Writes a bundle mode into Light and Dark, the collection's own when it has them. */
export function setLightAndDark(
  choice: CollectionImportChoice,
  from: number,
  collection: VariableCollection | undefined
): void {
  choice.modes[from] = modeNamed(THEME_MODE_NAMES.light, collection)
  const target = modeNamed(THEME_MODE_NAMES.dark, collection)
  const dark = { from, target, condition: darkCondition(target, collection) }
  choice.copies = [...(choice.copies ?? []).filter((copy) => copy.from !== from), dark]
}

/** Stops writing a bundle mode into Dark as well, as when another target is picked for it. */
export function clearLightAndDark(choice: CollectionImportChoice, from: number): void {
  choice.copies = (choice.copies ?? []).filter((copy) => copy.from !== from)
}

/**
 * The import's default choices, with a collection of one mode that matches none of the target's
 * written into Light and Dark, so code built from the design has a theme to switch.
 */
export function themeImportOptions(
  graph: SceneGraph,
  bundle: DesignTokenBundle
): TokenImportOptions {
  const options = defaultTokenImportOptions(graph, bundle)
  options.collections.forEach((choice, index) => {
    const single = bundle.collections[index]?.modes.length === 1
    if (single && choice.modes[0]?.kind === 'new')
      setLightAndDark(choice, 0, choiceCollection(graph, choice))
  })
  return options
}
