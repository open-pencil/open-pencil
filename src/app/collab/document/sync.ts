import { isEqual, isPlainObject, keyBy } from 'es-toolkit'
import * as v from 'valibot'
import type * as Y from 'yjs'

import type {
  CommentReply,
  CommentThread,
  DocumentColorSpace,
  EnabledLibraryBinding,
  PluginDataEntry
} from '@open-pencil/scene-graph'
import { commentThreadsSchema } from '@open-pencil/scene-graph/comments'
import {
  isPluginDataEntry,
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  withPluginData
} from '@open-pencil/scene-graph/plugin-data'

import type { EditorStore } from '@/app/editor/active-store'

import { changedIds, writeChanges, type YRecords } from '../records'
import { readRoot, type YMeta } from '../shared-tree/fields'

const { comments } = OPEN_PENCIL_PLUGIN_DATA
const COLOR_SPACE_KEY = 'colorSpace'
/** A thread's replies are a map of their own by id, so replies written at once all stay. */
const BY_REPLY = new Set(['replies'])

/** Plugin data of one plugin and key on the document node; a key may hold several values. */
type EntryRecord = { pluginId: string; key: string; values: string[] }
type ThreadRecord = Omit<CommentThread, 'replies'> & { replies: Record<string, CommentReply> }

const entryRecordSchema = v.object({
  pluginId: v.string(),
  key: v.string(),
  values: v.array(v.string())
})
const bindingSchema = v.object({
  libraryId: v.string(),
  revisionId: v.string(),
  enabled: v.boolean()
})
const colorSpaceSchema = v.picklist(['srgb', 'display-p3'] satisfies DocumentColorSpace[])

/**
 * The room's maps for what the document holds outside its layers: the document node's plugin
 * data by plugin and key, its comment threads by id, its libraries by id, and its settings,
 * such as the color space, by name.
 */
export type YDocumentData = {
  entries: YRecords
  threads: YRecords
  libraries: YRecords
  settings: Y.Map<unknown>
}

export function roomDocumentData(ydoc: Y.Doc): YDocumentData {
  return {
    entries: ydoc.getMap('documentEntries'),
    threads: ydoc.getMap('commentThreads'),
    libraries: ydoc.getMap('libraries'),
    settings: ydoc.getMap('documentSettings')
  }
}

type DocumentData = DocumentNodeData & {
  libraries: Map<string, EnabledLibraryBinding>
  colorSpace: DocumentColorSpace | undefined
}

/** The document node's plugin data as the room keeps it: entries by plugin and key, threads by id. */
type DocumentNodeData = {
  entries: Map<string, EntryRecord>
  threads: Map<string, ThreadRecord>
}

const entryId = (pluginId: string, key: string) => JSON.stringify([pluginId, key])

function threadRecord(thread: CommentThread): ThreadRecord {
  return { ...thread, replies: keyBy(thread.replies, (reply) => reply.id) }
}

/** A thread the room holds, read as files are; one that cannot be read is left out. */
function readThread(value: unknown): CommentThread | undefined {
  if (!isPlainObject(value)) return undefined
  const replies = isPlainObject(value.replies) ? Object.values(value.replies) : []
  const parsed = v.safeParse(commentThreadsSchema, [{ ...value, replies }])
  const thread = parsed.success ? parsed.output[0] : undefined
  return thread && { ...thread, replies: thread.replies.toSorted(byCreatedAt) }
}

function byCreatedAt(first: CommentReply, second: CommentReply): number {
  return first.createdAt.localeCompare(second.createdAt)
}

/** The document node's plugin data split as the room keeps it. */
function documentNodeData(pluginData: readonly PluginDataEntry[]): DocumentNodeData {
  const entries = new Map<string, EntryRecord>()
  for (const entry of pluginData) {
    if (isPluginDataEntry(entry, comments)) continue
    const id = entryId(entry.pluginId, entry.key)
    const record = entries.get(id) ?? { pluginId: entry.pluginId, key: entry.key, values: [] }
    record.values.push(entry.value)
    entries.set(id, record)
  }
  const threads = readPluginData(pluginData, comments) ?? []
  return { entries, threads: new Map(threads.map((thread) => [thread.id, threadRecord(thread)])) }
}

/** What the document holds that the room shares outside its layers. */
function readDocumentData(store: EditorStore): DocumentData {
  const { graph } = store
  return {
    ...documentNodeData(graph.getNode(graph.rootId)?.pluginData ?? []),
    libraries: structuredClone(graph.enabledLibraries),
    colorSpace: graph.documentColorSpace
  }
}

function pluginDataOf(data: DocumentData): PluginDataEntry[] {
  const entries = [...data.entries.values()]
    .toSorted((first, second) =>
      entryId(first.pluginId, first.key).localeCompare(entryId(second.pluginId, second.key))
    )
    .flatMap(({ pluginId, key, values }) => values.map((value) => ({ pluginId, key, value })))
  const threads = [...data.threads.values()].flatMap((record) => readThread(record) ?? [])
  return withPluginData(entries, comments, threads.length > 0 ? threads : undefined)
}

/** Takes the room's records with `ids`, or all of them, into `target`. */
function takeRecords<T>(
  records: YRecords,
  target: Map<string, T>,
  read: (value: unknown) => T | undefined,
  ids?: ReadonlySet<string>
): void {
  for (const id of ids ?? new Set([...records.keys(), ...target.keys()])) {
    const value = read(records.get(id)?.toJSON())
    if (value === undefined) target.delete(id)
    else target.set(id, value)
  }
}

const readEntry = (value: unknown) => {
  const parsed = v.safeParse(entryRecordSchema, value)
  return parsed.success ? parsed.output : undefined
}
const readBinding = (value: unknown) => {
  const parsed = v.safeParse(bindingSchema, value)
  return parsed.success ? parsed.output : undefined
}
const readThreadRecord = (value: unknown) => {
  const thread = readThread(value)
  return thread && threadRecord(thread)
}

/**
 * Keeps what the document holds outside its layers in step with the room: the document node's
 * plugin data, which holds the review statuses and file settings, entry by entry; comment
 * threads one by one with their replies by id, so people commenting at once all keep theirs;
 * the libraries it uses; and its color space. A viewer receives these and sends none.
 */
export function bindDocumentSync({
  store,
  ydoc,
  data,
  meta
}: {
  store: EditorStore
  ydoc: Y.Doc
  data: YDocumentData
  meta: YMeta
}) {
  // What the room holds as this peer last wrote or read it, so only what changed since is sent.
  let sent = readDocumentData(store)
  /** Set while the room's data is applied, so applying it is not sent back. */
  let receiving = false
  /** The root the room's document data was last taken in whole for. */
  let followedRoot: string | null = null

  function send() {
    // A joining tab's own document is not the room's until it follows the room.
    if (receiving || store.state.readOnly || !holdsRoomRoot()) return
    write()
  }

  function write() {
    const next = readDocumentData(store)
    ydoc.transact(() => {
      writeChanges(data.entries, next.entries, sent.entries)
      writeChanges(data.threads, next.threads, sent.threads, { nested: BY_REPLY })
      writeChanges(data.libraries, next.libraries, sent.libraries)
      if (next.colorSpace !== sent.colorSpace) data.settings.set(COLOR_SPACE_KEY, next.colorSpace)
    })
    sent = structuredClone(next)
  }

  /** Whether this tab shows the room's document, so its document node is the room's. */
  function holdsRoomRoot(): boolean {
    const rootId = readRoot(meta)
    return rootId !== undefined && rootId === store.graph.rootId
  }

  /**
   * Applies the room's records to the document; with no ids, all of them. They count as sent
   * before the document changes, so the change is not sent back.
   */
  function receive(ids?: {
    entries?: ReadonlySet<string>
    threads?: ReadonlySet<string>
    libraries?: ReadonlySet<string>
    settings?: true
  }) {
    const next = readDocumentData(store)
    if (!ids || ids.entries) takeRecords(data.entries, next.entries, readEntry, ids?.entries)
    if (!ids || ids.threads) takeRecords(data.threads, next.threads, readThreadRecord, ids?.threads)
    if (!ids || ids.libraries) {
      takeRecords(data.libraries, next.libraries, readBinding, ids?.libraries)
    }
    if (!ids || ids.settings) {
      const colorSpace = v.safeParse(colorSpaceSchema, data.settings.get(COLOR_SPACE_KEY))
      if (colorSpace.success) next.colorSpace = colorSpace.output
    }
    sent = structuredClone(next)
    receiving = true
    try {
      apply(next)
    } finally {
      receiving = false
    }
  }

  /**
   * Writes what the room holds into the document. Peers' settings go straight to the graph, as
   * peers' layers do, so a viewer, whose editor refuses edits, takes them too.
   */
  function apply(next: DocumentData) {
    const { graph } = store
    const root = graph.getNode(graph.rootId)
    const pluginData = pluginDataOf(next)
    if (root && !isEqual(root.pluginData, pluginData)) graph.updateNode(root.id, { pluginData })
    const libraries = !isEqual(graph.enabledLibraries, next.libraries)
    if (libraries) graph.enabledLibraries = structuredClone(next.libraries)
    const colorSpace = next.colorSpace !== undefined && next.colorSpace !== graph.documentColorSpace
    if (next.colorSpace !== undefined) graph.documentColorSpace = next.colorSpace
    if (libraries || colorSpace) store.refreshDocumentSettings()
  }

  /**
   * Once the tab shows the room's document, takes the room's document data in whole: the room
   * holds what its people changed since the document was saved.
   */
  function follow() {
    if (!holdsRoomRoot() || followedRoot === store.graph.rootId) return
    followedRoot = store.graph.rootId
    receive()
  }

  function observe(key: 'entries' | 'threads' | 'libraries') {
    const records = data[key]
    const handler = (events: Y.YEvent<Y.Map<unknown>>[], transaction: Y.Transaction) => {
      // This peer's own writes are already in its document; the room's document data reaches a
      // tab that shows another document when it follows the room.
      if (transaction.local || !holdsRoomRoot()) return
      receive({ [key]: changedIds(records, events) })
    }
    records.observeDeep(handler)
    return () => records.unobserveDeep(handler)
  }

  function onSettings(_event: Y.YMapEvent<unknown>, transaction: Y.Transaction) {
    if (transaction.local || !holdsRoomRoot()) return
    receive({ settings: true })
  }

  const stops = [
    observe('entries'),
    observe('threads'),
    observe('libraries'),
    store.onEditorEvent('node:updated', (id, changes) => {
      if (id === store.graph.rootId && 'pluginData' in changes) send()
    }),
    store.onEditorEvent('document:libraries-changed', send),
    store.onEditorEvent('document:color-space-changed', send)
  ]
  data.settings.observe(onSettings)

  return {
    /**
     * Writes everything, as Share does with the layers. It runs before Share claims the room's
     * root, and the sharing tab is the room's source, so it has nothing to follow.
     */
    share() {
      if (store.state.readOnly) return
      followedRoot = store.graph.rootId
      sent = { entries: new Map(), threads: new Map(), libraries: new Map(), colorSpace: undefined }
      write()
    },
    follow,
    dispose() {
      for (const stop of stops) stop()
      data.settings.unobserve(onSettings)
    }
  }
}
