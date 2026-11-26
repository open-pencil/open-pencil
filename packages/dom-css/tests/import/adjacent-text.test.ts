import { describe, expect, it } from 'bun:test'

import { parseHTMLDocument } from '#dom-css/import/markup'
import type { DesignElement } from '#dom-css/index'

describe('text a comment splits', () => {
  it('reads as one run, as the browser lays it out', () => {
    const [label] = parseHTMLDocument('<span class="label">Category<!-- -->:</span>').children

    expect((label as DesignElement).children).toEqual([{ type: 'text', text: 'Category:' }])
  })
})
