import { useClipboard, useShare } from '@vueuse/core'
import { computed } from 'vue'

import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'

/** How a link went out: through the system share sheet, onto the clipboard, or not at all. */
export type SentLink = 'shared' | 'copied' | 'cancelled'

/**
 * Sends a link the way the device does: on a phone through the system share sheet, as other apps
 * send theirs, and elsewhere, or where the browser has no sheet, by copying it. Call it straight
 * from the tap, before anything awaits, since the sheet opens only then.
 */
export function useSendLink() {
  const { share, isSupported } = useShare()
  const { copy, copied } = useClipboard({ legacy: true })
  const { isMobile } = useViewportKind()
  const sendsLink = computed(() => isMobile.value && isSupported.value)

  async function send(url: string, title?: string): Promise<SentLink> {
    if (!sendsLink.value) {
      await copy(url)
      return 'copied'
    }
    try {
      await share({ title, url })
      return 'shared'
    } catch (error) {
      // Closing the sheet without sending is a choice; any other failure still gets the link out.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      await copy(url)
      return 'copied'
    }
  }

  return { sendsLink, copied, send }
}
