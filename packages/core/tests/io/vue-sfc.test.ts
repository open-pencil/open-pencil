import { expect, test } from 'bun:test'

import { htmlToVueSFC } from '#core/io/formats/vue-sfc/assemble'

test('the body becomes the template and the stylesheet its own style block', () => {
  const html = [
    '<!doctype html><html><head><style>.card{color:red}</style></head>',
    '<body><div class="card">Hi</div></body></html>'
  ].join('')
  const sfc = htmlToVueSFC(html)
  expect(sfc).toContain('<template>\n<div class="card">Hi</div>\n</template>')
  expect(sfc).toContain('.card{color:red}')
  expect(sfc).toContain('<script setup lang="ts">')
  expect(sfc).not.toContain('<body')
  expect(sfc).not.toContain('<head')
})

test('markup without a document shell is the template itself', () => {
  const sfc = htmlToVueSFC('<div data-layer="card">Hi</div>')
  expect(sfc).toContain('<template>\n<div data-layer="card">Hi</div>\n</template>')
  expect(sfc).not.toContain('<style>')
})
