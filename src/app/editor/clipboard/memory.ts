let memoryClipboardHTML = ''

export function setInMemoryClipboardHTML(html: string): void {
  memoryClipboardHTML = html
}

export function getInMemoryClipboardHTML(): string {
  return memoryClipboardHTML
}

export function hasInMemoryClipboardHTML(): boolean {
  return Boolean(memoryClipboardHTML)
}

export function clearInMemoryClipboardHTML(): void {
  memoryClipboardHTML = ''
}
