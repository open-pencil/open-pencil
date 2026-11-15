import { watch } from 'vue'

import { CloudAPIError, type CloudCommentRequests } from '@open-pencil/cloud/client'
import {
  MAX_COMMENTS_PER_THREAD,
  MAX_IMPORTED_COMMENT_THREADS,
  MAX_IMPORTED_COMMENTS,
  type CloudCommentThread,
  type CommentThreads,
  type ImportCommentThreadsInput
} from '@open-pencil/cloud/contract'
import { readComments, writeComments } from '@open-pencil/scene-graph/comments'

import { setCommentsKeptElsewhere } from '@/app/comments/document'
import type { EditorStore } from '@/app/editor/session'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { allTabs, getTabsSnapshot } from '@/app/tabs'

import { isCloudBinding } from '../documents/status'
import { cloudShareLinkTabs } from '../reports/tabs'
import { onceOnServer } from '../rooms/upload'
import { cloudConnections } from '../sessions/connection'
import { cloudShareTarget } from '../sharing/document'
import { shareLinkClient } from '../sharing/link'
import { followers, type CloudCommentFollower } from './followers'
import {
  cloudCommentChanges,
  documentThread,
  importedThreads,
  threadAnchor,
  type CloudCommentChange
} from './threads'

/** How long a change the server could not take waits before it is sent again. */
const RETRY_MS = 5_000

type ImportThreads = (input: ImportCommentThreadsInput) => Promise<CommentThreads>

/** Where a tab's comments are kept, and how a document still on its way there gets them. */
export type CloudCommentTarget = {
  /** Which document and which way in, so a tab that moves follows its new one. */
  key: string
  requests: () => Promise<CloudCommentRequests>
  /** Runs `request` once the document is on the server, for one whose first upload is pending. */
  onServer?: <T>(request: () => Promise<T>) => Promise<T>
  /**
   * How the threads the file held go to the server, for a document this device has not uploaded
   * yet; null for any other.
   */
  importer?: () => Promise<ImportThreads | null>
}

function commentTarget(store: EditorStore): CloudCommentTarget | null {
  const binding = store.getStorageBinding()
  if (binding && isCloudBinding(binding)) {
    const target = cloudShareTarget(binding)
    if (!target) return null
    const { client, documentId } = target
    return {
      key: `${target.server.id}:${documentId}:${target.accountId ?? ''}`,
      requests: async () => client.documentComments(documentId),
      onServer: (request) => onceOnServer(documentId, request),
      importer: async () => {
        const meta = await getLocalCanvasStore().getMeta(documentId)
        if (!meta || meta.remoteRevision) return null
        return (input) => client.importCommentThreads(documentId, input)
      }
    }
  }
  const link = cloudShareLinkTabs.value.get(store)
  if (!link) return null
  return {
    key: `${link.server}:share:${link.shareId}`,
    requests: async () =>
      (await shareLinkClient(link)).client.sharedComments(link.shareId, link.secret)
  }
}

/** Splits a file's threads into imports the server takes at once. */
function importBatches(input: ImportCommentThreadsInput): ImportCommentThreadsInput[] {
  const batches: ImportCommentThreadsInput[] = []
  let current: ImportCommentThreadsInput['threads'] = []
  let comments = 0
  for (const thread of input.threads) {
    const kept = { ...thread, comments: thread.comments.slice(0, MAX_COMMENTS_PER_THREAD) }
    if (
      current.length >= MAX_IMPORTED_COMMENT_THREADS ||
      comments + kept.comments.length > MAX_IMPORTED_COMMENTS
    ) {
      batches.push({ threads: current })
      current = []
      comments = 0
    }
    current.push(kept)
    comments += kept.comments.length
  }
  if (current.length > 0) batches.push({ threads: current })
  return batches
}

/** A refusal that sending again will not change, unlike a server out of reach. */
function refused(error: unknown): boolean {
  return error instanceof CloudAPIError && error.status >= 400 && error.status < 500
}

/**
 * Keeps a Cloud tab's comments in step with its server, which keeps them. The document holds the
 * server's threads, so the comment list, pins, scripts, agents and Save As read them as before;
 * what the tab changes in them goes to the server, and what anyone changes there comes back, when
 * the room says so or the tab asks. They are never part of what the tab uploads.
 *
 * A document this device has not uploaded yet brings the comments its file held: they go to the
 * server under the names the file gave. Any other document shows what the server holds, whatever
 * its file carried.
 */
export function followCloudComments(
  store: EditorStore,
  target: CloudCommentTarget
): CloudCommentFollower {
  // One follower a tab: the one it had stops before this one takes over.
  followers.get(store)?.stop()
  /** The server's threads as last heard, by ID. */
  const server = new Map<string, CloudCommentThread>()
  let loaded = false
  let stopped = false
  let flushing: Promise<void> | null = null
  /** Set while the server's threads are written into the document, so that is not sent back. */
  let writing = false
  /** Counts the tab's own comment changes, so a flush that crossed one runs again. */
  let changes = 0
  let retry: ReturnType<typeof setTimeout> | null = null
  let requests: CloudCommentRequests | null = null

  const api = async () => (requests ??= await target.requests())

  /** Shows what the server holds; changes the tab has not sent yet are sent before this. */
  function show() {
    if (stopped) return
    const threads = [...server.values()]
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(documentThread)
    writing = true
    try {
      store.adoptChanges(() => writeComments(store.graph, threads))
    } finally {
      writing = false
    }
  }

  function remember(thread: CloudCommentThread | null, threadId: string) {
    if (thread) server.set(thread.id, thread)
    else server.delete(threadId)
  }

  async function send(change: CloudCommentChange) {
    const cloud = await api()
    switch (change.kind) {
      case 'create-thread': {
        const { thread } = change
        remember(
          await cloud.createThread({
            id: thread.id,
            ...threadAnchor(thread),
            body: thread.text,
            agent: thread.agent
          }),
          thread.id
        )
        return
      }
      case 'update-thread':
        remember(await cloud.updateThread(change.threadId, change.input), change.threadId)
        return
      case 'delete-thread':
        await cloud.deleteThread(change.threadId)
        server.delete(change.threadId)
        return
      case 'reply':
        remember(
          await cloud.reply(change.threadId, {
            id: change.reply.id,
            body: change.reply.text,
            agent: change.reply.agent
          }),
          change.threadId
        )
        return
      case 'edit':
        remember(
          await cloud.updateComment(change.threadId, change.commentId, { body: change.body }),
          change.threadId
        )
        return
      case 'delete-comment':
        remember(await cloud.deleteComment(change.threadId, change.commentId), change.threadId)
    }
  }

  /** Reads every thread again, after the server refused a change or the tab joined late. */
  async function reload() {
    const listed = await (await api()).list()
    server.clear()
    for (const thread of listed.threads) server.set(thread.id, thread)
    setCommentsKeptElsewhere(store, { canComment: listed.access.canComment })
  }

  /**
   * Sends what the tab changed, one request at a time, then shows the server's threads. A change
   * the server refuses is dropped: the server's copy shows again, as anyone else would see it.
   * One it could not reach is sent again later.
   */
  function flush(): Promise<void> {
    flushing ??= (async () => {
      try {
        let seen = -1
        // The tab may change its comments, or close, while a request is on its way.
        const pending = () => !stopped && seen !== changes
        while (pending()) {
          seen = changes
          for (const change of cloudCommentChanges(readComments(store.graph), server)) {
            try {
              await send(change)
            } catch (error) {
              if (!refused(error)) throw error
              await reload()
            }
          }
        }
        show()
      } catch (error) {
        console.warn('[Cloud] Comments could not reach the server; trying again', error)
        retry ??= setTimeout(() => {
          retry = null
          void flush()
        }, RETRY_MS)
      } finally {
        flushing = null
      }
    })()
    return flushing
  }

  async function load() {
    // Asked before the first upload lands, which would make the document an uploaded one.
    const importThreads = (await target.importer?.()) ?? null
    const imports = importThreads ? importBatches(importedThreads(readComments(store.graph))) : []
    const list = () => api().then((cloud) => cloud.list())
    const listed = target.onServer ? await target.onServer(list) : await list()
    if (stopped) return
    for (const thread of listed.threads) server.set(thread.id, thread)
    setCommentsKeptElsewhere(store, { canComment: listed.access.canComment })
    if (importThreads) {
      for (const batch of imports) {
        for (const thread of (await importThreads(batch)).threads) server.set(thread.id, thread)
      }
    }
    loaded = true
    show()
  }

  const stops = [
    store.onEditorEvent('node:updated', (id) => {
      if (writing || id !== store.graph.rootId) return
      changes++
      if (loaded) void flush()
    }),
    // Another file in the tab's place, such as a restored version, shows the server's threads.
    store.onEditorEvent('graph:replaced', () => {
      if (loaded) show()
    })
  ]

  // Until the server says otherwise, the tab writes nothing it might refuse.
  setCommentsKeptElsewhere(store, { canComment: false })
  const loading = load().catch((error: unknown) => {
    console.warn('[Cloud] Could not load the document’s comments', error)
  })

  const follower: CloudCommentFollower = {
    key: target.key,
    async changed(threadId) {
      if (!loaded || stopped) return
      try {
        remember(await (await api()).get(threadId), threadId)
      } catch (error) {
        if (!(error instanceof CloudAPIError && error.status === 404)) throw error
        server.delete(threadId)
      }
      await flush()
    },
    async idle() {
      await loading
      // A flush that crossed a change runs again within itself, so one wait covers it.
      await flushing
    },
    stop() {
      stopped = true
      if (retry) clearTimeout(retry)
      for (const stop of stops) stop()
      setCommentsKeptElsewhere(store, null)
      if (followers.get(store) === follower) followers.delete(store)
    }
  }
  followers.set(store, follower)
  return follower
}

/** Follows the comments of every open Cloud document, as tabs open, move, and sign in. */
export function watchCloudComments(): () => void {
  return watch(
    () => {
      void allTabs.value
      void cloudConnections.value
      void cloudShareLinkTabs.value
      return getTabsSnapshot().map((tab) => [tab.store, tab.store.getStorageBinding()] as const)
    },
    (entries) => {
      const open = new Set(entries.map(([store]) => store))
      for (const [store, follower] of followers) {
        if (!open.has(store)) follower.stop()
      }
      for (const [store] of entries) {
        const target = commentTarget(store)
        const current = followers.get(store)
        if (current?.key === target?.key) continue
        current?.stop()
        if (target) followCloudComments(store, target)
      }
    },
    { immediate: true }
  )
}
