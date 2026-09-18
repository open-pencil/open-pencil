// openpencil://open?file=<relative>&node=<name>. The file is resolved against the
// paths of the open tabs by whole trailing segments, so a one-segment file takes
// the first open tab whose path ends with it. The segment comparison is the
// filesystem's, not JavaScript's: the desktop build asks Rust, which folds ASCII
// case on macOS and Windows and compares exactly on Linux. Otherwise the user picks it once
// per link and the pick must end with the same relative path. A file the link
// opens — the picked one — lands in the recent-files list like any other file
// opened from the app; focusing an already open tab opens nothing and so does
// not touch the list. No fs
// scope is widened here: the dialog plugin scopes what it returns, and nothing
// else is ever read from disk.
import { notificationMessages } from '@/app/i18n/notifications'
import { activateTabForPath, chooseTauriOpenPaths, openFileFromPath } from '@/app/shell/menu/files'

export interface DeepLinkTarget {
  path: string
  node?: string
}

export interface DeepLinkActions {
  /** Absolute paths of the documents currently open in tabs. */
  openPaths: () => string[]
  /** Selects the node and zooms to it. False when no node carries that name. */
  selectByName: (name: string) => boolean
  notify: (message: string) => void
}

/** A link is attacker-supplied text; a toast is not a place for 4 KB of it. */
export function clamp(value: string): string {
  return value.length > 120 ? `${value.slice(0, 119)}…` : value
}

/**
 * Whether `candidate` ends with `relative` as whole path segments, decided by the
 * `path_matches_suffix` Tauri command: it canonicalizes the candidate and compares
 * its trailing segments the way the platform's filesystem does. Doing this in JS
 * would either be case-sensitive (and cancel a link whose case differs on macOS or
 * Windows) or lowercase everything (and match the wrong file on Linux).
 */
export type SuffixMatcher = (candidate: string, relative: string) => Promise<boolean>

const tauriMatchesSuffix: SuffixMatcher = async (candidate, relative) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<boolean>('path_matches_suffix', { candidate, suffix: relative })
}

export async function resolveDeepLinkFile(
  file: string,
  openPaths: string[],
  matches: SuffixMatcher = tauriMatchesSuffix
): Promise<string | null> {
  for (const path of openPaths) {
    if (await matches(path, file)) return path
  }
  return null
}

/** File-system entry points, injected so tests can drive the picker branch. */
interface DeepLinkIo {
  choosePaths: () => Promise<string[]>
  openPath: (path: string) => Promise<void>
  /** Focuses the tab already showing `path`. False when no tab holds it. */
  activateTab: (path: string) => Promise<boolean>
  matchesSuffix: SuffixMatcher
}

const tauriIo: DeepLinkIo = {
  choosePaths: chooseTauriOpenPaths,
  openPath: openFileFromPath,
  activateTab: activateTabForPath,
  matchesSuffix: tauriMatchesSuffix
}

export async function openDeepLink(
  target: DeepLinkTarget,
  actions: DeepLinkActions,
  io: DeepLinkIo = tauriIo
): Promise<void> {
  const messages = notificationMessages.get()
  const known = await resolveDeepLinkFile(target.path, actions.openPaths(), io.matchesSuffix)
  if (known) {
    // An already open document is focused, never re-read from disk: re-reading would
    // fail the whole link when the file moved or turned unreadable since it opened.
    // It can also have closed between the snapshot and the activate — open it then.
    if (!(await io.activateTab(known))) await io.openPath(known)
  } else {
    actions.notify(messages.deepLinkLocateFile({ file: clamp(target.path) }))
    const chosen = await io.choosePaths()
    // Dismissing the picker is not the same as picking the wrong file, so it gets its
    // own notice instead of one that talks about a file the user never chose.
    if (chosen.length === 0) {
      actions.notify(messages.deepLinkPickerDismissed)
      return
    }
    const picked = await resolveDeepLinkFile(target.path, chosen, io.matchesSuffix)
    if (!picked) {
      actions.notify(messages.deepLinkCancelled({ file: clamp(target.path) }))
      return
    }
    await io.openPath(picked)
  }
  if (target.node && !actions.selectByName(target.node)) {
    actions.notify(
      messages.deepLinkNodeNotFound({ node: clamp(target.node), file: clamp(target.path) })
    )
  }
}
