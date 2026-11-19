import { expect, test } from 'bun:test'

import { createStaticVNode } from 'vue'

import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'
test('the host renderer mounts and removes compiled static content', () => {
  const renderer = createTestRenderer()
  const root = hostNode()
  renderer.render(createStaticVNode('<span>Static content</span>', 1), root)
  expect(root.children).toHaveLength(1)
  expect(root.children[0].text).toBe('<span>Static content</span>')
  expect(root.children[0].parent).toBe(root)
  renderer.render(null, root)
  expect(root.children).toEqual([])
})
