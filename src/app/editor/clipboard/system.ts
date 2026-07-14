import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { readTauriClipboardText, writeTauriClipboardHtml } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

type ClipboardStore = Pick<EditorStore, 'deleteSelected' | 'pasteFromHTML' | 'writeCopyData'>
type SelectionClipboardData = { html: string; plainText: string }
type EditableTarget = Element & {
  focus?: (options?: FocusOptions) => void
  blur?: () => void
  isConnected?: boolean
  ownerDocument?: Document | null
}

let rememberedEditableTarget: EditableTarget | null = null
let blockedEditableTarget: EditableTarget | null = null
let trackedDocument: Document | null = null
let stopTrackingDocument: (() => void) | null = null
let trackingReferenceCount = 0
let lastPointerWasMenuTarget = false
let lastPointerTarget: Element | null = null

function createTransfer() {
  if (typeof DataTransfer === 'undefined') return null
  return new DataTransfer()
}

function isDesignClipboardHtml(text: string) {
  return text.includes('<!--(openpencil)') || text.includes('(figma)')
}

function currentDocument(): Document | null {
  return typeof document === 'undefined' ? null : document
}

function isEditableElement(element: Element | null): element is EditableTarget {
  if (!element) return false
  if (typeof HTMLInputElement !== 'undefined' && element instanceof HTMLInputElement) return true
  if (typeof HTMLTextAreaElement !== 'undefined' && element instanceof HTMLTextAreaElement) {
    return true
  }
  return (
    typeof HTMLElement !== 'undefined' &&
    element instanceof HTMLElement &&
    element.isContentEditable
  )
}

function isUsableEditableTarget(
  element: Element | null,
  doc: Document | null
): element is EditableTarget {
  if (!isEditableElement(element)) return false
  if (!element.isConnected) return false
  if (doc && element.ownerDocument !== doc) return false
  return true
}

function isMenuFocusTarget(element: Element | null): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const role = current.getAttribute('role')
    if (role === 'menu' || role === 'menubar' || role === 'menuitem') return true
  }
  return false
}

function usableBlockedEditableTarget(doc: Document | null): EditableTarget | null {
  if (!doc) {
    blockedEditableTarget = null
    return null
  }
  if (!isUsableEditableTarget(blockedEditableTarget, doc)) {
    blockedEditableTarget = null
    return null
  }
  return blockedEditableTarget
}

function elementContains(root: Element, child: Element | null): boolean {
  if (root === child) return true
  if (!child) return false
  if (typeof root.contains === 'function') return root.contains(child)
  for (let current: Element | null = child; current; current = current.parentElement) {
    if (current === root) return true
  }
  return false
}

function hadDirectPointerIntoTarget(target: Element): boolean {
  if (lastPointerWasMenuTarget) return false
  return elementContains(target, lastPointerTarget)
}

function isMenuRestoredEditableTarget(target: Element): boolean {
  if (hadDirectPointerIntoTarget(target)) return false
  return lastPointerWasMenuTarget
}

export function rememberClipboardEditableTarget(element: Element | null | undefined) {
  const doc = currentDocument()
  const target = element ?? null
  if (isUsableEditableTarget(target, doc)) {
    const blockedTarget = usableBlockedEditableTarget(doc)
    if (blockedTarget && isMenuRestoredEditableTarget(target)) {
      rememberedEditableTarget = null
      lastPointerWasMenuTarget = false
      return
    }
    blockedEditableTarget = null
    rememberedEditableTarget = target
    lastPointerWasMenuTarget = false
    return
  }
  if (isMenuFocusTarget(target)) {
    lastPointerWasMenuTarget = true
    lastPointerTarget = target
    return
  }
  const activeElement = doc?.activeElement ?? null
  let blockedTarget: EditableTarget | null = null
  if (isUsableEditableTarget(rememberedEditableTarget, doc)) {
    blockedTarget = rememberedEditableTarget
  } else if (isUsableEditableTarget(activeElement, doc)) {
    blockedTarget = activeElement
  }
  if (blockedTarget) {
    blockedEditableTarget = blockedTarget
  } else if (!isUsableEditableTarget(blockedEditableTarget, doc)) {
    blockedEditableTarget = null
  }
  rememberedEditableTarget = null
}

export function clearClipboardEditableTarget() {
  rememberedEditableTarget = null
  blockedEditableTarget = null
  lastPointerWasMenuTarget = false
  lastPointerTarget = null
}

export function trackClipboardEditableFocus(doc = currentDocument()) {
  if (!doc) return () => undefined

  if (trackedDocument && trackedDocument !== doc) {
    stopTrackingDocument?.()
    trackedDocument = null
    stopTrackingDocument = null
    trackingReferenceCount = 0
  }

  if (!trackedDocument) {
    const recordFocusTarget = (event: Event) => {
      rememberClipboardEditableTarget(event.target as Element | null)
    }
    const recordPointerTarget = (event: Event) => {
      const target = event.target as Element | null
      lastPointerTarget = target
      lastPointerWasMenuTarget = isMenuFocusTarget(target)
      rememberClipboardEditableTarget(target)
    }
    doc.addEventListener('focusin', recordFocusTarget, true)
    doc.addEventListener('pointerdown', recordPointerTarget, true)
    trackedDocument = doc
    stopTrackingDocument = () => {
      doc.removeEventListener('focusin', recordFocusTarget, true)
      doc.removeEventListener('pointerdown', recordPointerTarget, true)
    }
  }

  trackingReferenceCount += 1
  rememberClipboardEditableTarget(doc.activeElement)

  let disposed = false
  return () => {
    if (disposed) return undefined
    disposed = true
    trackingReferenceCount -= 1
    if (trackingReferenceCount <= 0) {
      stopTrackingDocument?.()
      trackedDocument = null
      stopTrackingDocument = null
      trackingReferenceCount = 0
    }
    return undefined
  }
}

function focusedEditableElement(doc: Document | null): EditableTarget | null {
  if (!doc) return null
  const activeElement = doc.activeElement
  if (!isUsableEditableTarget(activeElement, doc)) return null
  if (usableBlockedEditableTarget(doc) && rememberedEditableTarget !== activeElement) return null
  blockedEditableTarget = null
  rememberedEditableTarget = activeElement
  return activeElement
}

function rememberedEditableElement(doc: Document | null): EditableTarget | null {
  if (!doc) {
    rememberedEditableTarget = null
    return null
  }
  if (!usableBlockedEditableTarget(doc) && isUsableEditableTarget(rememberedEditableTarget, doc)) {
    return rememberedEditableTarget
  }
  rememberedEditableTarget = null
  return null
}

function editableClipboardTarget(): EditableTarget | null {
  const doc = currentDocument()
  return focusedEditableElement(doc) ?? rememberedEditableElement(doc)
}

function focusEditableTarget(element: EditableTarget) {
  const doc = currentDocument()
  if (!doc || doc.activeElement === element || typeof element.focus !== 'function') return
  try {
    element.focus({ preventScroll: true })
  } catch {
    element.focus()
  }
}

function nodeWithinElement(element: Element, node: Node | null): boolean {
  if (!node) return false
  return node === element || element.contains(node)
}

function clearEditableSelection(element: EditableTarget, doc: Document) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const selectionEnd = element.selectionEnd
    if (selectionEnd == null || typeof element.setSelectionRange !== 'function') return
    try {
      element.setSelectionRange(selectionEnd, selectionEnd)
    } catch (error) {
      console.warn('Failed to clear blocked editable selection', error)
    }
    return
  }

  const selection = doc.getSelection()
  if (!selection) return
  if (
    !nodeWithinElement(element, selection.anchorNode) &&
    !nodeWithinElement(element, selection.focusNode)
  ) {
    return
  }
  selection.removeAllRanges()
}

function execClipboardCommand(command: 'copy' | 'cut' | 'paste') {
  if (typeof document === 'undefined') return false
  try {
    return document.execCommand(command)
  } catch (error) {
    console.warn(`Clipboard command ${command} failed`, error)
    return false
  }
}

function blurBlockedEditableTarget() {
  const doc = currentDocument()
  const blockedTarget = usableBlockedEditableTarget(doc)
  if (!doc || !blockedTarget) return false
  clearEditableSelection(blockedTarget, doc)
  const activeElement = doc.activeElement
  if (isUsableEditableTarget(activeElement, doc)) {
    if (activeElement !== blockedTarget) clearEditableSelection(activeElement, doc)
    activeElement.blur?.()
    return true
  }
  blockedTarget.blur?.()
  return true
}

async function readSelectionClipboardData(
  store: Pick<EditorStore, 'writeCopyData'>
): Promise<SelectionClipboardData | null> {
  const transfer = createTransfer()
  if (!transfer) return null
  await store.writeCopyData(transfer)
  const html = transfer.getData('text/html')
  const plainText = transfer.getData('text/plain')
  if (!html && !plainText) return null
  return { html, plainText }
}

export async function copySelectionToTauriClipboard(store: Pick<EditorStore, 'writeCopyData'>) {
  if (!isTauri()) return false
  try {
    const data = await readSelectionClipboardData(store)
    if (!data) return false
    await writeTauriClipboardHtml(data.html || data.plainText, data.plainText)
    return true
  } catch (error) {
    console.warn('Tauri clipboard copy failed', error)
    return false
  }
}

async function copySelectionToBrowserClipboard(store: Pick<EditorStore, 'writeCopyData'>) {
  if (typeof navigator === 'undefined') return false
  if (!('clipboard' in navigator)) return false
  const clipboard = navigator.clipboard
  if (typeof ClipboardItem === 'undefined') return false
  if (typeof clipboard.write !== 'function') return false

  try {
    const data = await readSelectionClipboardData(store)
    if (!data) return false
    const itemData: Record<string, Blob> = {}
    if (data.plainText) itemData['text/plain'] = new Blob([data.plainText], { type: 'text/plain' })
    if (data.html) itemData['text/html'] = new Blob([data.html], { type: 'text/html' })
    await clipboard.write([new ClipboardItem(itemData)])
    return true
  } catch (error) {
    console.warn('Browser clipboard copy failed', error)
  }

  return false
}

async function copySelectionToSystemClipboard(store: Pick<EditorStore, 'writeCopyData'>) {
  if (await copySelectionToTauriClipboard(store)) return true
  return copySelectionToBrowserClipboard(store)
}

export async function pasteFromTauriClipboard(
  store: Pick<EditorStore, 'pasteFromHTML'>,
  cursorPos?: Vector
) {
  if (!isTauri()) return false
  try {
    const text = await readTauriClipboardText()
    if (!text || !isDesignClipboardHtml(text)) return false
    await store.pasteFromHTML(text, cursorPos)
    return true
  } catch (error) {
    console.warn('Tauri clipboard paste failed', error)
    return false
  }
}

export async function executeClipboardCommand(
  store: ClipboardStore,
  command: 'copy' | 'cut' | 'paste'
) {
  const editableTarget = editableClipboardTarget()
  if (editableTarget) {
    focusEditableTarget(editableTarget)
    return execClipboardCommand(command)
  }
  const blockedEditable = blurBlockedEditableTarget()

  if (command === 'copy') {
    if (await copySelectionToSystemClipboard(store)) return true
    if (blockedEditable) return false
  }

  if (command === 'cut') {
    if (await copySelectionToSystemClipboard(store)) {
      store.deleteSelected()
      return true
    }
    if (blockedEditable) return false
  }

  if (command === 'paste') {
    if (await pasteFromTauriClipboard(store)) return true
  }

  return execClipboardCommand(command)
}
