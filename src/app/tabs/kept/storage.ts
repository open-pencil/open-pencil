// Where a browser tab keeps the designs it had open, so a reload opens them again: raw text in
// `sessionStorage`, which `index.ts` validates. Kept apart so the boot splash, which runs before
// the app loads, can ask whether there are any without loading the app.

/** Each browser tab keeps its own designs, and a reload keeps them. */
const KEPT_TABS_STORAGE_KEY = 'open-pencil:kept-tabs'

/** Session storage, absent or throwing in private windows and with site data blocked. */
function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export function readKeptTabsText(): string | null {
  try {
    return session()?.getItem(KEPT_TABS_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/** Writes the kept designs, or forgets them with `null`, so `hasKeptTabs` is false with none. */
export function writeKeptTabsText(text: string | null): void {
  const storage = session()
  if (!storage) return
  if (text === null) storage.removeItem(KEPT_TABS_STORAGE_KEY)
  else storage.setItem(KEPT_TABS_STORAGE_KEY, text)
}

/** Whether this browser tab has designs to reopen. */
export function hasKeptTabs(): boolean {
  return readKeptTabsText() !== null
}
