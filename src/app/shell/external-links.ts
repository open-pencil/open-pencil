import { useEventListener } from '@vueuse/core'

import { isTauri } from '@/app/tauri/env'

import { openExternalLink } from './ui'

/**
 * Opens links meant for a new tab, `<a target="_blank">`, in the system browser on the desktop,
 * after the link's own handlers. The shell plugin's handler on `<body>` would open them with
 * `shell:allow-open`, which the app does not grant, even when the link handles its click itself,
 * as a chat link does to ask first; such a link opens with `window.open`, which the desktop shell
 * sends to the browser (`open_new_window_externally` in `desktop/src/system/opener.rs`).
 */
export function useExternalLinks() {
  if (!isTauri()) return
  useEventListener(
    document,
    'click',
    (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target !== '_blank') return
      // Added while the click is captured, it runs after the link's own handlers in this click.
      anchor.addEventListener(
        'click',
        (click) => {
          click.stopPropagation()
          if (click.defaultPrevented) return
          click.preventDefault()
          void openExternalLink(anchor.href)
        },
        { once: true }
      )
    },
    { capture: true }
  )
}
