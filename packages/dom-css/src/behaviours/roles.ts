import type { ControlModel } from './controls'

/** What a layer below a root is to the controls in it. */
export type ControlRole =
  | { type: 'root'; control: ControlModel }
  | { type: 'part'; control: ControlModel; part: string }
  | { type: 'item'; group: ControlModel; control: ControlModel; index: number }
  | { type: 'trigger'; control: ControlModel; index: number }
  | { type: 'panel'; control: ControlModel; index: number }
  | { type: 'text'; control: ControlModel; valueId: string }

/**
 * Each layer's role by layer path: control roots, their parts, items of groups, tab triggers
 * and panels, and the text layers that become inputs. Items of a group take the item role in
 * place of their root role, since the group drives them.
 */
export function controlRoles(
  controls: ReadonlyMap<string, ControlModel>
): Map<string, ControlRole> {
  const roles = new Map<string, ControlRole>()
  for (const control of controls.values()) {
    if (!roles.has(control.path)) roles.set(control.path, { type: 'root', control })
    for (const [part, path] of Object.entries(control.parts))
      if (!roles.has(path)) roles.set(path, { type: 'part', control, part })
    for (const [valueId, text] of Object.entries(control.texts))
      roles.set(text.path, { type: 'text', control, valueId })
    for (const [index, path] of control.triggers.entries())
      roles.set(path, { type: 'trigger', control, index })
    for (const [index, path] of control.panels.entries())
      roles.set(path, { type: 'panel', control, index })
    for (const [index, item] of control.items.entries())
      roles.set(item.path, { type: 'item', group: control, control: item, index })
  }
  return roles
}

/** The group a control is an item of, if any. */
export function groupOf(
  roles: ReadonlyMap<string, ControlRole>,
  control: ControlModel
): ControlModel | undefined {
  const role = roles.get(control.path)
  return role?.type === 'item' ? role.group : undefined
}
