import type { SceneNode } from './types'

export function markSourceFieldsEdited(node: SceneNode, changeKeys: string[]): void {
  if (changeKeys.length === 0) return
  const editedFields = new Set(node.source.editedFields)
  for (const key of changeKeys) editedFields.add(key)
  node.source.editedFields = [...editedFields]
}
