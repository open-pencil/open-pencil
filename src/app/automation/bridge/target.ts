import type { AutomationDocumentSummary } from '@open-pencil/core/rpc'

import type { EditorStore } from '@/app/editor/active-store'
import { getTabById, getTabForStore, getTabsSnapshot, type Tab } from '@/app/tabs'

export type UnknownRecord = { [key: string]: unknown }

export type AutomationTargetArgs = {
  document_id?: unknown
  page_id?: unknown
}

export function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export type AutomationTarget = {
  store: EditorStore
  documentId: string
  documentName: string
  path?: string
  pageId: string
  pageName: string
}

export type AutomationTargetResult = Omit<AutomationTarget, 'store'>

export function stripAutomationTargetArgs(args: UnknownRecord): UnknownRecord {
  const { document_id: _documentId, page_id: _pageId, ...rest } = args
  return rest
}

export function targetToResult(target: AutomationTarget): AutomationTargetResult {
  return {
    documentId: target.documentId,
    documentName: target.documentName,
    ...(target.path ? { path: target.path } : {}),
    pageId: target.pageId,
    pageName: target.pageName
  }
}

export type TargetResponse = Record<string, unknown> & { target: AutomationTargetResult }

export function responseWithTarget(body: unknown, target: AutomationTarget): TargetResponse {
  const targetResult = targetToResult(target)
  if (isUnknownRecord(body)) {
    return { ...body, target: targetResult }
  }
  return { ok: true, result: body, target: targetResult }
}

/**
 * `tab` when it holds a document. Home and a New file tab carry an empty editor the window never
 * shows as a design, so automation neither lists nor edits them.
 */
function documentTab(tab: Tab | undefined): Tab | undefined {
  return tab?.kind === 'document' ? tab : undefined
}

function documentTabs(): Tab[] {
  return getTabsSnapshot().filter((tab) => tab.kind === 'document')
}

const NON_DOCUMENT_TAB_NAMES: Partial<Record<Tab['kind'], string>> = {
  home: 'Home',
  'new-file': 'a New file tab'
}

/** Why a call that names no document has none to work on, and what to call instead. */
function selectedTabNotDocumentError(selected: Tab | undefined): Error {
  const shown = selected && NON_DOCUMENT_TAB_NAMES[selected.kind]
  const reason = shown ? `The selected tab is ${shown}, not a document` : 'No document is open'
  const open = documentTabs().map((tab) => `${tab.id} ("${tab.store.state.documentName}")`)
  const next =
    open.length > 0
      ? `Pass document_id to work on an open document: ${open.join(', ')}.`
      : 'Create one with create_document or open a file with open_document.'
  return new Error(`${reason}. ${next}`)
}

export function listAutomationDocuments(activeStore: EditorStore): AutomationDocumentSummary[] {
  const activeTab = getTabForStore(activeStore)
  return documentTabs().map((tab) => {
    const pages = tab.store.graph.getPages().map((page) => ({ id: page.id, name: page.name }))
    const currentPage = tab.store.graph.getNode(tab.store.state.currentPageId)
    const path = tab.store.getDocumentFilePath()
    return {
      id: tab.id,
      name: tab.store.state.documentName,
      ...(path ? { path } : {}),
      active: tab.id === activeTab?.id,
      current_page_id: tab.store.state.currentPageId,
      current_page_name: currentPage?.name ?? '',
      pages
    }
  })
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function resolveAutomationTarget(
  activeStore: EditorStore,
  args: AutomationTargetArgs | undefined
): AutomationTarget {
  const requestedDocumentId = readString(args?.document_id)
  const selected = getTabForStore(activeStore)
  const tab = documentTab(requestedDocumentId ? getTabById(requestedDocumentId) : selected)
  if (!tab) {
    throw requestedDocumentId
      ? new Error(`Document "${requestedDocumentId}" not found`)
      : selectedTabNotDocumentError(selected)
  }

  const requestedPageId = readString(args?.page_id)
  const pageId = requestedPageId ?? tab.store.state.currentPageId
  const page = tab.store.graph.getNode(pageId)
  if (page?.type !== 'CANVAS') {
    throw new Error(`Page "${pageId}" not found in document "${tab.id}"`)
  }

  const path = tab.store.getDocumentFilePath()
  return {
    store: tab.store,
    documentId: tab.id,
    documentName: tab.store.state.documentName,
    ...(path ? { path } : {}),
    pageId,
    pageName: page.name
  }
}

/**
 * The document each agent session last worked on, by session id, with its name for when it
 * closes. A call that names no document stays there, rather than following whichever tab the
 * person or another agent brings to the front. An app chat's agent has its chat's document
 * instead.
 */
const sessionDocuments = new Map<string, { id: string; name: string }>()

/** `args` with the document the session `session` last worked on, when they name none. */
export function withSessionDocument(
  session: string | undefined,
  args: UnknownRecord
): UnknownRecord {
  if (session === undefined || readString(args.document_id)) return args
  const remembered = sessionDocuments.get(session)
  if (!remembered) return args
  if (!documentTab(getTabById(remembered.id))) {
    throw new Error(
      `The document this session worked on, "${remembered.name}", is closed. ` +
        'Pass document_id from list_documents to work on an open document.'
    )
  }
  return { ...args, document_id: remembered.id }
}

/** Remembers that the session `session` worked on `target`'s document. */
export function rememberSessionDocument(
  session: string | undefined,
  target: Pick<AutomationTargetResult, 'documentId' | 'documentName'>
): void {
  if (session === undefined) return
  sessionDocuments.set(session, { id: target.documentId, name: target.documentName })
}

export function forgetSessionDocument(session: string): void {
  sessionDocuments.delete(session)
}
