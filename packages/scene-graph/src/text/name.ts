import type { SceneNode } from '../types'

/** The name a text layer that follows its text takes: its characters on one line, as Figma names it. */
export function textLayerName(text: string): string {
  return text.replace(/\s+/g, ' ').trim() || 'Text'
}

/**
 * The name `changes` also sets on a text layer that follows its text (`autoRename`): its new text
 * written, or following turned back on. A name the write gives itself wins, so a rename, or undo
 * putting one back, is kept; setting the name alone does not stop the layer following its text,
 * which a rename does by setting `autoRename` to false with it.
 */
export function textNameChanges(node: SceneNode, changes: Partial<SceneNode>): Partial<SceneNode> {
  if (node.type !== 'TEXT' || 'name' in changes) return {}
  if (!('text' in changes) && changes.autoRename !== true) return {}
  if (!(changes.autoRename ?? node.autoRename)) return {}
  const name = textLayerName(changes.text ?? node.text)
  return name === node.name ? {} : { name }
}

/** What renaming a layer writes: the name, and on a text layer an end to following its text. */
export function renameChanges(node: SceneNode, name: string): Partial<SceneNode> {
  return node.type === 'TEXT' ? { name, autoRename: false } : { name }
}

/**
 * What making a text layer from `overrides` also sets: the name of its text, as an edit sets it,
 * or, given a name other than its text's, an end to following it, as a rename makes. A follow
 * flag the overrides give, as a file or a copy gives, is kept.
 */
export function newTextNameChanges(
  node: SceneNode,
  overrides: Partial<SceneNode>
): Partial<SceneNode> {
  if (node.type !== 'TEXT' || !('name' in overrides) || 'autoRename' in overrides)
    return textNameChanges(node, overrides)
  return node.name === textLayerName(node.text) ? {} : { autoRename: false }
}
