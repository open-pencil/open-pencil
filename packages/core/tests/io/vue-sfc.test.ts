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

test('a stylesheet the markup carries moves out of the template', () => {
  const sfc = htmlToVueSFC('<style>.card{color:red}</style><div class="card">Hi</div>')

  expect(sfc).toContain('<template>\n<div class="card">Hi</div>\n</template>')
  expect(sfc.match(/\.card\{color:red\}/g)).toHaveLength(1)
})

test('braces a layer shows stay text rather than becoming an interpolation', () => {
  const sfc = htmlToVueSFC('<p>Total: {{ price }}</p>')

  expect(sfc).not.toContain('{{ price }}')
  expect(sfc).toContain('<p>Total: &#123;&#123; price }}</p>')
})

test('an attribute value keeps the braces it was given', () => {
  const sfc = htmlToVueSFC('<div data-text="{{ price }}">Hi</div>')

  expect(sfc).toContain('<div data-text="{{ price }}">Hi</div>')
})
