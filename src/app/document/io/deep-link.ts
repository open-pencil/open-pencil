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
import type { LinkedNodeIdentity, LinkedNodeResult } from '@/app/document/io/linked-node'
import { notificationMessages } from '@/app/i18n/notifications'
import { activateTabForPath, chooseTauriOpenPaths, openFileFromPath } from '@/app/shell/menu/files'

export interface DeepLinkTarget {
  path: string
  node?: string
  nodeId?: string
  revision?: string
}

export interface DeepLinkActions {
  /** Absolute paths of the documents currently open in tabs. */
  openPaths: () => string[]
  /** Selects the node and zooms to it. False when no node carries that name. */
  selectByName: (name: string) => boolean | Promise<boolean>
  selectById?: (target: LinkedNodeIdentity) => Promise<LinkedNodeResult>
  notify: (message: string) => void
}

/** A link is attacker-supplied text; a toast is not a place for 4 KB of it. */
export function clamp(value: string): string {
  return value.length > 120 ? `${value.slice(0, 119)}…` : value
}

/**
 * Runs a link's layer search. Searching can load other pages after the file opened, so a
 * failure is reported as an error rather than as a layer the document does not carry.
 */
export async function searchLinkedNode(
  selectByName: (name: string) => boolean | Promise<boolean>,
  name: string
): Promise<{ found: boolean } | { error: string }> {
  try {
    return { found: await selectByName(name) }
  } catch (error) {
    return { error: clamp(error instanceof Error ? error.message : String(error)) }
  }
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
  matches: SuffixMatcher = tauriMatchesSuffix,
  unique = false
): Promise<string | null> {
  const found: string[] = []
  for (const path of openPaths) {
    if (await matches(path, file)) {
      if (!unique) return path
      found.push(path)
    }
  }
  if (found.length > 1)
    throw new Error(
      `Several open or chosen documents match ${clamp(file)}. Close other checkouts or choose one file.`
    )
  return found[0] ?? null
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
  const known = await resolveDeepLinkFile(
    target.path,
    actions.openPaths(),
    io.matchesSuffix,
    !!target.nodeId
  )
  let openedPath = known
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
    const picked = await resolveDeepLinkFile(target.path, chosen, io.matchesSuffix, !!target.nodeId)
    if (!picked) {
      actions.notify(messages.deepLinkCancelled({ file: clamp(target.path) }))
      return
    }
    await io.openPath(picked)
    openedPath = picked
  }
  if (target.nodeId && openedPath) {
    const error = await linkedIdentityNotice(actions.selectById, {
      id: target.nodeId,
      file: openedPath,
      revision: target.revision
    })
    if (error) actions.notify(error)
    return
  }
  if (!target.node) return
  const search = await searchLinkedNode(actions.selectByName, target.node)
  if ('error' in search) actions.notify(messages.operationFailed(search))
  else if (!search.found)
    actions.notify(
      messages.deepLinkNodeNotFound({ node: clamp(target.node), file: clamp(target.path) })
    )
}

/** Stable identity failures never fall back to mutable names or imported graph handles. */
export async function linkedIdentityNotice(
  select: DeepLinkActions['selectById'],
  target: LinkedNodeIdentity
): Promise<string | null> {
  if (!select) return 'This editor cannot resolve persisted design identities.'
  try {
    const result = await select(target)
    if (result === 'found' || result === 'superseded') return null
    if (result === 'stale')
      return 'Design revision does not match, or this document has edits. Reopen the saved .fig and update the mapping or reference.'
    if (result === 'ambiguous')
      return 'Several layers carry this persisted design identity. Repair the document before following the link.'
    return `Persisted design identity ${clamp(target.id)} was not found in this document.`
  } catch (error) {
    return notificationMessages
      .get()
      .operationFailed({ error: clamp(error instanceof Error ? error.message : String(error)) })
  }
}
