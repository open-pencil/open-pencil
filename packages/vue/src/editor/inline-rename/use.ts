import { onClickOutside } from '@vueuse/core'
import { nextTick, ref, type Ref } from 'vue'

import { blurTarget } from '#vue/shared/dom-events'

export interface InlineRenameState<T extends string> {
  editingId: Ref<T | null>
  start: (id: T, currentName: string) => void
  focusInput: (input: HTMLInputElement | null) => Promise<void>
  commit: (id: T, eventOrInput: Event | HTMLInputElement) => void
  cancel: () => void
  onKeydown: (e: KeyboardEvent) => void
}

export function useInlineRename<T extends string>(
  onCommit: (id: T, newName: string) => void
): InlineRenameState<T> {
  const editingId: Ref<T | null> = ref(null)
  const inputRef: Ref<HTMLInputElement | null> = ref(null)
  let originalName = ''
  let cleanupOutsideClick: (() => void) | undefined

  function start(id: T, currentName: string) {
    editingId.value = id
    originalName = currentName
  }

  async function focusInput(input: HTMLInputElement | null) {
    if (input === inputRef.value) return
    inputRef.value = input
    cleanupOutsideClick?.()
    if (input) {
      cleanupOutsideClick = onClickOutside(inputRef, () => input.blur())
    }
    await nextTick()
    input?.focus()
    input?.select()
  }

  function commit(id: T, eventOrInput: Event | HTMLInputElement) {
    if (editingId.value !== id) return
    let input: HTMLInputElement | null
    if (eventOrInput instanceof HTMLInputElement) {
      input = eventOrInput
    } else {
      input = eventOrInput.target instanceof HTMLInputElement ? eventOrInput.target : null
    }
    if (!input) return
    const value = input.value.trim()
    if (value && value !== originalName) {
      onCommit(id, value)
    }
    editingId.value = null
    inputRef.value = null
    cleanupOutsideClick?.()
    cleanupOutsideClick = undefined
  }

  function cancel() {
    editingId.value = null
    inputRef.value = null
    cleanupOutsideClick?.()
    cleanupOutsideClick = undefined
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.code === 'Enter') {
      blurTarget(e)
      return
    }

    if (e.code === 'Escape') {
      cancel()
    }
  }

  return { editingId, start, focusInput, commit, cancel, onKeydown }
}
