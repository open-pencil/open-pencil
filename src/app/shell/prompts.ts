import { ref } from 'vue'

/**
 * In-app replacements for window.confirm()/prompt(). Native dialogs are
 * silent no-ops in the Tauri webview, so these render as real dialogs
 * (AppPrompts.vue, mounted once in App.vue) on every platform.
 */

type ConfirmRequest = {
  kind: 'confirm'
  message: string
  confirmLabel: string
  danger: boolean
  resolve: (ok: boolean) => void
}

type PromptRequest = {
  kind: 'prompt'
  title: string
  initial: string
  resolve: (value: string | null) => void
}

export const activePrompt = ref<ConfirmRequest | PromptRequest | null>(null)

function settle<T>(value: T, resolve: (v: T) => void) {
  activePrompt.value = null
  resolve(value)
}

export function confirmDialog(
  message: string,
  options: { confirmLabel?: string; danger?: boolean } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    // A newer request replaces a stale one; the old promise resolves cancelled
    if (activePrompt.value) cancelActivePrompt()
    activePrompt.value = {
      kind: 'confirm',
      message,
      confirmLabel: options.confirmLabel ?? 'OK',
      danger: options.danger ?? false,
      resolve: (ok: boolean) => settle(ok, resolve)
    }
  })
}

export function promptText(title: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    if (activePrompt.value) cancelActivePrompt()
    activePrompt.value = {
      kind: 'prompt',
      title,
      initial,
      resolve: (value: string | null) => settle(value, resolve)
    }
  })
}

export function cancelActivePrompt() {
  const current = activePrompt.value
  if (!current) return
  if (current.kind === 'confirm') current.resolve(false)
  else current.resolve(null)
}
