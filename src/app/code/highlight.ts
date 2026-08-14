import { toHtml as toHTML } from 'hast-util-to-html'
import { refractor } from 'refractor/core'
import jsx from 'refractor/jsx'

refractor.register(jsx)

export function highlightJSX(code: string): string {
  return toHTML(refractor.highlight(code, 'jsx'))
}
