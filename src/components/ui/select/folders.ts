/** What a picker choice needs to sit in a folder. */
interface FolderItem {
  value: string
  section?: string
  folder?: string
}

/** A row of a picker group: a choice, or the header of a folder of choices. */
export type AppPickerRow<T extends FolderItem> =
  | { kind: 'section'; key: string; name: string; open: boolean }
  | { kind: 'item'; item: T; nested: boolean }
  | { kind: 'folder'; key: string; name: string; items: T[]; open: boolean }

/** Whether a folder shows its choices, by its key, name, and choices. */
export type FolderOpenness<T extends FolderItem> = (
  key: string,
  folder: string,
  items: T[]
) => boolean

/** How a group's folders and section headings show: open or closed, by key. */
export interface PickerOpenness<T extends FolderItem> {
  folder: FolderOpenness<T>
  section: (key: string) => boolean
}

export function folderKey(group: string, folder: string): string {
  return `${group}\u0000${folder}`
}

export function sectionKey(group: string, section: string): string {
  return `${folderKey(group, section)}\u0000section`
}

/**
 * A group's rows in the order its choices come: a section's heading where its first choice is,
 * what the section holds while it is open, each folder where its first choice is, its choices
 * under it while it is open, and loose choices as they are.
 */
export function pickerRows<T extends FolderItem>(
  group: string,
  entries: readonly T[],
  openness: PickerOpenness<T>
): AppPickerRow<T>[] {
  const folders = folderContents(entries)
  const placed = new Set<string>()
  return entries.flatMap((item): AppPickerRow<T>[] => {
    const heading = sectionHeading(group, item, placed, openness)
    if (item.section && !openness.section(sectionKey(group, item.section))) return heading
    if (!item.folder) return [...heading, { kind: 'item', item, nested: false }]
    const key = folderKey(group, folderPath(item))
    if (placed.has(key)) return heading
    placed.add(key)
    const items = folders.get(folderPath(item)) ?? []
    return [...heading, ...folderRows(key, item.folder, items, openness.folder)]
  })
}

/** The heading of the item's section, the first time the section comes. */
function sectionHeading<T extends FolderItem>(
  group: string,
  { section }: T,
  placed: Set<string>,
  openness: PickerOpenness<T>
): AppPickerRow<T>[] {
  if (!section) return []
  const key = sectionKey(group, section)
  if (placed.has(key)) return []
  placed.add(key)
  return [{ kind: 'section', key, name: section, open: openness.section(key) }]
}

/** A folder is told apart by its section too: `red` under `color` and under `border`. */
function folderPath({ section, folder }: FolderItem): string {
  return `${section ?? ''}\u0000${folder ?? ''}`
}

function folderContents<T extends FolderItem>(entries: readonly T[]): Map<string, T[]> {
  const folders = new Map<string, T[]>()
  for (const item of entries) {
    if (!item.folder) continue
    const path = folderPath(item)
    folders.set(path, [...(folders.get(path) ?? []), item])
  }
  return folders
}

function folderRows<T extends FolderItem>(
  key: string,
  name: string,
  items: T[],
  isOpen: FolderOpenness<T>
): AppPickerRow<T>[] {
  const open = isOpen(key, name, items)
  const header: AppPickerRow<T> = { kind: 'folder', key, name, items, open }
  if (!open) return [header]
  return [header, ...items.map((item): AppPickerRow<T> => ({ kind: 'item', item, nested: true }))]
}
