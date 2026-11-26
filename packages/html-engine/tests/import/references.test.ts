import { expect, test } from 'bun:test'

import { engineRuntime } from '../helpers/engine'

test('references keep substituted tokens apart from those around them', async () => {
  const runtime = engineRuntime()
  const document = runtime.parseHTML(
    '<p style="--family: var(--prefix) Open; font-family: var(--family)Sans, A var(--family)">x</p>'
  )
  const { children } = await runtime.computeStyles(document, ':root { --prefix: Brand }', {
    references: true
  })
  const [element] = children
  expect(element.type === 'element' && element.references?.['font-family']).toBe(
    'var(--prefix) Open Sans, A var(--prefix) Open'
  )
})
