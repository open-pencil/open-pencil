import { nextTick, ref } from 'vue'

export function useInlineRename(onCommit: (id: string, newName: string) => void) {
  const editingId = ref<string | null>(null)
  let originalName = ''

  function start(id: string, currentName: string, selector: string) {
    editingId.value = id
    originalName = currentName
    nextTick(() => {
      const input = document.querySelector<HTMLInputElement>(selector)
      input?.focus()
      input?.select()
    })
  }

  function commit(id: string, input: HTMLInputElement) {
    if (editingId.value !== id) return
    const value = input.value.trim()
    if (value && value !== originalName) {
      onCommit(id, value)
    }
    editingId.value = null
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return { editingId, start, commit, onKeydown }
}
