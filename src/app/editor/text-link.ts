import { shallowRef } from 'vue'

/**
 * Asks for the link of the selected text to be edited, as Add link (Mod+K) does; the panel's link
 * field takes focus each time it changes.
 */
export const textLinkRequests = shallowRef(0)

export function requestTextLink(): void {
  textLinkRequests.value++
}
