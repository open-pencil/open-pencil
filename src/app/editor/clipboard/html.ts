export function isDesignClipboardHTML(html: string): boolean {
  return html.includes('<!--(openpencil)') || html.includes('(figma)')
}
