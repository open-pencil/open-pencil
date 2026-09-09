import type { BindingProvider, BindingTarget, BindingValueEdit } from './types'

/** Capture and deduplicate edit destinations before an interaction starts. */
export function prepareBindingEdits<V>(
  provider: BindingProvider<V>,
  targets: readonly BindingTarget[]
): BindingValueEdit<V>[] | undefined {
  const edits = new Map<string, BindingValueEdit<V>>()
  for (const target of targets) {
    const captured = { ...target }
    const variable = provider.getBound(captured)
    if (!variable) return undefined
    const edit = provider.prepareEdit?.(variable.id, captured)
    if (!edit) return undefined
    edits.set(edit.key, edit)
  }
  return [...edits.values()]
}
