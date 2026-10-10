import { uniq } from 'es-toolkit'

import { EDITOR_TOOLS, type EditorToolDef, type Tool } from '@open-pencil/core/editor'

/** Toolbar buttons that run a command instead of switching the tool. */
export const TOOLBAR_ACTIONS = ['insert-icon'] as const
export type ToolbarAction = (typeof TOOLBAR_ACTIONS)[number]
export type ToolbarEntry = Tool | ToolbarAction

/**
 * What the toolbar shows, in order. A group of one is a button and a larger group is a flyout
 * keyed by its first shown member. Hidden entries keep their place so showing them restores it.
 */
export interface ToolbarLayout {
  groups: ToolbarEntry[][]
  hidden: ToolbarEntry[]
}

/** The one entry the toolbar always shows, so it is never empty. */
export const PINNED_TOOLBAR_ENTRY: ToolbarEntry = 'SELECT'

export const DEFAULT_TOOLBAR_LAYOUT: Readonly<ToolbarLayout> = {
  groups: [
    ...EDITOR_TOOLS.map((tool) => [...(tool.flyout ?? [tool.key])]),
    ...TOOLBAR_ACTIONS.map((action) => [action])
  ],
  hidden: []
}

const ENTRIES = DEFAULT_TOOLBAR_LAYOUT.groups.flat()

export function isToolbarEntry(value: unknown): value is ToolbarEntry {
  return ENTRIES.some((entry) => entry === value)
}

export function isToolbarAction(entry: ToolbarEntry): entry is ToolbarAction {
  return TOOLBAR_ACTIONS.some((action) => action === entry)
}

function groupOf(groups: ToolbarEntry[][], entry: ToolbarEntry) {
  return groups.find((group) => group.includes(entry))
}

/**
 * Places an entry the stored layout lacks, such as a tool added in a later release: into its
 * default flyout when another member of it is placed, otherwise after the entry before it.
 */
function placeMissing(groups: ToolbarEntry[][], entry: ToolbarEntry) {
  const home = groupOf(DEFAULT_TOOLBAR_LAYOUT.groups, entry) ?? [entry]
  const sibling = home.find((member) => member !== entry && groupOf(groups, member))
  const siblingGroup = sibling && groupOf(groups, sibling)
  if (siblingGroup) {
    const before = home
      .slice(0, home.indexOf(entry))
      .findLast((member) => siblingGroup.includes(member))
    siblingGroup.splice(before ? siblingGroup.indexOf(before) + 1 : 0, 0, entry)
    return
  }
  const anchor = ENTRIES.slice(0, ENTRIES.indexOf(entry)).findLast((other) =>
    groupOf(groups, other)
  )
  const at = anchor ? groups.findIndex((group) => group.includes(anchor)) + 1 : 0
  groups.splice(at, 0, [entry])
}

/**
 * Reads a stored layout: unknown entries and repeats are dropped, actions stand alone, empty
 * groups go, and entries it does not mention are placed as `placeMissing` describes.
 */
export function normalizeToolbarLayout(
  storedGroups: readonly (readonly unknown[])[],
  storedHidden: readonly unknown[]
): ToolbarLayout {
  const groups: ToolbarEntry[][] = []
  const placed = new Set<ToolbarEntry>()
  for (const stored of storedGroups) {
    let group: ToolbarEntry[] = []
    for (const value of stored) {
      if (!isToolbarEntry(value) || placed.has(value)) continue
      placed.add(value)
      if (!isToolbarAction(value)) {
        group.push(value)
        continue
      }
      if (group.length > 0) groups.push(group)
      groups.push([value])
      group = []
    }
    if (group.length > 0) groups.push(group)
  }
  for (const entry of ENTRIES) if (!placed.has(entry)) placeMissing(groups, entry)
  const hidden = uniq(storedHidden.filter(isToolbarEntry)).filter(
    (entry) => entry !== PINNED_TOOLBAR_ENTRY
  )
  return { groups, hidden }
}

export type ToolbarItem =
  | { kind: 'tool'; tool: EditorToolDef }
  | { kind: 'action'; action: ToolbarAction }

/** The toolbar's buttons and flyouts for a layout, without its hidden entries. */
export function toolbarItems(
  layout: ToolbarLayout,
  labels: Readonly<Record<Tool, string>>,
  shortcuts: Readonly<Record<Tool, string>>
): ToolbarItem[] {
  return layout.groups.flatMap((group): ToolbarItem[] => {
    const shown = group.filter((entry) => !layout.hidden.includes(entry))
    const first = shown.at(0)
    if (first === undefined) return []
    if (isToolbarAction(first)) return [{ kind: 'action', action: first }]
    const tools = shown.filter((entry): entry is Tool => !isToolbarAction(entry))
    const tool: EditorToolDef = { key: first, label: labels[first], shortcut: shortcuts[first] }
    if (tools.length > 1) tool.flyout = tools
    return [{ kind: 'tool', tool }]
  })
}

/** One entry as Settings lists it, with how it relates to the row above. */
export interface ToolbarRow {
  entry: ToolbarEntry
  hidden: boolean
  /** In the same flyout as the row above. */
  joined: boolean
  /** Can share a flyout with the row above: both are tools in different groups. */
  canJoin: boolean
  canMoveUp: boolean
  canMoveDown: boolean
}

/** Whether a group can merge into the one above it: both exist and neither is a command. */
function canJoinAbove(groups: ToolbarEntry[][], groupIndex: number) {
  if (groupIndex < 1 || groupIndex >= groups.length) return false
  const [first] = groups[groupIndex]
  const [above] = groups[groupIndex - 1]
  return !isToolbarAction(first) && !isToolbarAction(above)
}

export function toolbarRows(layout: ToolbarLayout): ToolbarRow[] {
  const { groups } = layout
  return groups.flatMap((group, groupIndex) =>
    group.map((entry, index) => {
      const alone = group.length === 1
      return {
        entry,
        hidden: layout.hidden.includes(entry),
        joined: index > 0,
        canJoin: index === 0 && canJoinAbove(groups, groupIndex),
        canMoveUp: !alone || groupIndex > 0,
        canMoveDown: !alone || groupIndex < groups.length - 1
      }
    })
  )
}

function locate(layout: ToolbarLayout, entry: ToolbarEntry) {
  const groups = layout.groups.map((group) => [...group])
  const groupIndex = groups.findIndex((group) => group.includes(entry))
  const group = groupIndex === -1 ? undefined : groups[groupIndex]
  return { groups, groupIndex, group, index: group ? group.indexOf(entry) : -1 }
}

export function setToolbarEntryHidden(
  layout: ToolbarLayout,
  entry: ToolbarEntry,
  hidden: boolean
): ToolbarLayout {
  if (entry === PINNED_TOOLBAR_ENTRY) return layout
  const others = layout.hidden.filter((other) => other !== entry)
  return { groups: layout.groups, hidden: hidden ? [...others, entry] : others }
}

/**
 * Moves an entry one step. Inside a flyout it moves among the flyout's members and past either
 * end becomes a button of its own; a button swaps places with the button or flyout next to it.
 */
export function moveToolbarEntry(
  layout: ToolbarLayout,
  entry: ToolbarEntry,
  step: -1 | 1
): ToolbarLayout {
  const { groups, groupIndex, group, index } = locate(layout, entry)
  if (!group) return layout
  if (group.length === 1) {
    const target = groupIndex + step
    if (target < 0 || target >= groups.length) return layout
    groups[groupIndex] = groups[target]
    groups[target] = group
    return { ...layout, groups }
  }
  const target = index + step
  if (target < 0 || target >= group.length) {
    group.splice(index, 1)
    groups.splice(step < 0 ? groupIndex : groupIndex + 1, 0, [entry])
    return { ...layout, groups }
  }
  group.splice(index, 1)
  group.splice(target, 0, entry)
  return { ...layout, groups }
}

/** Merges the entry's group into the group above it, making one flyout. */
export function joinToolbarEntry(layout: ToolbarLayout, entry: ToolbarEntry): ToolbarLayout {
  const { groups, groupIndex, group, index } = locate(layout, entry)
  if (!group || index !== 0 || !canJoinAbove(groups, groupIndex)) return layout
  groups.splice(groupIndex - 1, 2, [...groups[groupIndex - 1], ...group])
  return { ...layout, groups }
}

/** Splits the entry's flyout above the entry. */
export function splitToolbarEntry(layout: ToolbarLayout, entry: ToolbarEntry): ToolbarLayout {
  const { groups, groupIndex, group, index } = locate(layout, entry)
  if (!group || index < 1) return layout
  groups.splice(groupIndex, 1, group.slice(0, index), group.slice(index))
  return { ...layout, groups }
}

function withoutEntry(layout: ToolbarLayout, entry: ToolbarEntry) {
  return layout.groups
    .map((group) => group.filter((member) => member !== entry))
    .filter((group) => group.length > 0)
}

/**
 * Drops an entry at `index` of the list without it. Between two members of a flyout it joins
 * that flyout; anywhere else it becomes a button of its own, as does a command.
 */
export function placeToolbarEntry(
  layout: ToolbarLayout,
  entry: ToolbarEntry,
  index: number
): ToolbarLayout {
  const groups = withoutEntry(layout, entry)
  const flat = groups.flat()
  const before = index > 0 ? flat[index - 1] : undefined
  const after = index < flat.length ? flat[index] : undefined
  const host = before && groupOf(groups, before)
  if (host && after && host.includes(after) && !isToolbarAction(entry)) {
    host.splice(host.indexOf(before) + 1, 0, entry)
    return { ...layout, groups }
  }
  const at = before ? groups.findIndex((group) => group.includes(before)) + 1 : 0
  groups.splice(at, 0, [entry])
  return { ...layout, groups }
}

/** Drops an entry onto a tool: both share that tool's flyout, the entry right after it. */
export function combineToolbarEntry(
  layout: ToolbarLayout,
  entry: ToolbarEntry,
  target: ToolbarEntry
): ToolbarLayout {
  if (!toolbarDropOperations(layout, entry, target).combine) return layout
  const groups = withoutEntry(layout, entry)
  const host = groupOf(groups, target)
  if (!host) return layout
  host.splice(host.indexOf(target) + 1, 0, entry)
  return { ...layout, groups }
}

/**
 * Where an entry can be dropped on a row: onto another group's tool to share its flyout, and
 * before or after any row, except that a command only lands between groups.
 */
export function toolbarDropOperations(
  layout: ToolbarLayout,
  entry: ToolbarEntry,
  target: ToolbarEntry
) {
  const group = groupOf(layout.groups, target) ?? [target]
  const action = isToolbarAction(entry)
  return {
    'reorder-before': !action || group[0] === target,
    'reorder-after': !action || group.at(-1) === target,
    combine: !action && !isToolbarAction(target) && !group.includes(entry)
  }
}
