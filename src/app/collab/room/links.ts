/** The desktop app's link for a room, which it opens in a tab of its own. */
export function roomLinkURL(roomId: string): string {
  return `openpencil://join?room=${encodeURIComponent(roomId)}`
}
