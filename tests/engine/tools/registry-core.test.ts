import { describe, expect, test } from 'bun:test'

import { CORE_TOOLS } from '@open-pencil/core/tools'

describe('Design Agent core tool registry', () => {
  test('exposes the document-inspection tools required by the system prompt', () => {
    const names = new Set(CORE_TOOLS.map((tool) => tool.name))

    expect(names).toContain('list_pages')
    expect(names).toContain('get_page_tree')
    expect(names).toContain('switch_page')
    expect(names).toContain('export_image')
  })
})
