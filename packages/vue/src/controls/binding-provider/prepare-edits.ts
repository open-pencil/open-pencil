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
    let edit: BindingValueEdit<V> | undefined
    if (provider.prepareEdit) {
      edit = provider.prepareEdit(variable.id, captured)
    } else {
      const value = provider.resolve(variable.id, captured)
      if (value === undefined || !provider.setValue) return undefined
      edit = {
        key: JSON.stringify([variable.id, captured]),
        value: structuredClone(value),
        set: (next) => provider.setValue?.(variable.id, next, captured)
      }
    }
    if (!edit) return undefined
    edits.set(edit.key, edit)
  }
  return [...edits.values()]
}
