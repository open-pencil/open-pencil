// The queue the desktop shell fills before the editor exists: a double-clicked
// document, an `Open With`, an argv path, or an `openpencil://` link. Rust tags each
// entry with its producer because the frontend cannot tell them apart from the path
// alone — a link's path is repo-relative, but a canonicalized Windows path is verbatim
// (`\\?\C:\…`) and an association path can be anything the filesystem allows.
//
// This lives outside `WorkspaceView.vue` so the routing — which entry goes to the
// deep-link resolver and which to the plain opener — is unit-testable without mounting
// a view.
import type { DeepLinkActions, DeepLinkTarget } from '@/app/document/io/deep-link'
import { openDeepLink } from '@/app/document/io/deep-link'
import { openDesignFileBatch, openFileFromPath } from '@/app/shell/menu/files'

export interface PendingOpenFile extends DeepLinkTarget {
  /** True when a `openpencil://` link queued this entry, false for a file association. */
  deepLink: boolean
}

/** File-system entry points, injected so tests can observe the routing. */
export interface PendingOpenIo {
  openPath: (path: string) => Promise<void>
  openLink: (target: DeepLinkTarget, actions: DeepLinkActions) => Promise<void>
}

const tauriIo: PendingOpenIo = { openPath: openFileFromPath, openLink: openDeepLink }

function displayName(file: PendingOpenFile): string {
  return file.path.split(/[/\\]/).pop() ?? file.path
}

/**
 * Serialised, but one failing entry must not swallow the rest of the batch:
 * `openDesignFileBatch` is the per-item catch every other open path already uses, so a
 * rejection is logged *and* toasted and the drain carries on to the next file.
 */
export async function openPendingFiles(
  files: readonly PendingOpenFile[],
  actions: DeepLinkActions,
  io: PendingOpenIo = tauriIo
): Promise<void> {
  await openDesignFileBatch(files, displayName, async (file) => {
    // Only the deep-link resolver may turn a link's relative path into a real one.
    if (file.deepLink) await io.openLink({ path: file.path, node: file.node }, actions)
    else await io.openPath(file.path)
  })
}
