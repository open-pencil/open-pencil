const LAWHA_START = '<!--(lawha)'
const LAWHA_END = '(/lawha)-->'
const FIGMA_START = '<!--(figma)'
const FIGMA_END = '(/figma)-->'
const ESCAPED_FIGMA_START = '&lt;!--(figma)'
const ESCAPED_FIGMA_END = '(/figma)--&gt;'

function hasCompleteMarker(html: string, start: string, end: string): boolean {
  const startIndex = html.indexOf(start)
  return startIndex !== -1 && html.includes(end, startIndex + start.length)
}

export function isDesignClipboardHTML(html: string): boolean {
  return (
    hasCompleteMarker(html, LAWHA_START, LAWHA_END) ||
    hasCompleteMarker(html, FIGMA_START, FIGMA_END) ||
    hasCompleteMarker(html, ESCAPED_FIGMA_START, ESCAPED_FIGMA_END)
  )
}
