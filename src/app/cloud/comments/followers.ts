import type { EditorStore } from '@/app/editor/session'

/** A tab's comments followed on its server. */
export type CloudCommentFollower = {
  key: string
  /** Someone changed a thread on the server: fetch it, then show it with the tab's own changes. */
  changed(threadId: string): Promise<void>
  /** Resolves once the comments are loaded and every change the tab made so far was sent. */
  idle(): Promise<void>
  stop(): void
}

/**
 * Each tab's follower, so the room's word that a thread changed reaches it. It lives apart from
 * the followers, whose requests go through modules the room's own code imports.
 */
export const followers = new Map<EditorStore, CloudCommentFollower>()

/** The server said a thread of the document the tab shows changed. */
export function cloudCommentsChanged(store: EditorStore, threadId: string): void {
  void followers
    .get(store)
    ?.changed(threadId)
    .catch((error: unknown) => {
      console.warn('[Cloud] Could not fetch a changed comment', error)
    })
}
