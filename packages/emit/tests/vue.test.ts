import { describe, expect, test } from 'bun:test'

import { es, vue } from '#emit/index'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

/** Renders printed markup with Vue's own template compiler and server renderer. */
async function render(node: vue.VueNode, data: Record<string, unknown> = {}): Promise<string> {
  const app = createSSRApp({ template: vue.printTemplate(node), data: () => data })
  return renderToString(app)
}

describe('Vue templates', () => {
  test.each(['{{ evil }}', '<b>bold</b>', 'Fish &amp; chips', 'a { b } c'])(
    'keep text %p as written',
    async (value) => {
      const html = await render(vue.element('p', [], [vue.text(value)]), { evil: 'injected' })
      const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      expect(html).toBe(`<p>${escaped}</p>`)
    }
  )

  test('keep attribute values with quotes and entities as written', async () => {
    const value = 'say "hi" &amp; leave'
    const html = await render(vue.element('div', [vue.attribute('title', value)]))
    expect(html).toBe('<div title="say &quot;hi&quot; &amp;amp; leave"></div>')
  })

  test('bind expressions, including string literals with quotes', async () => {
    const node = vue.element('div', [
      vue.bound('data-size', es.identifier('size')),
      vue.bound('title', es.string('a "quoted" title'))
    ])
    expect(vue.printTemplate(node)).toBe(
      `<div :data-size="size" :title="'a &quot;quoted&quot; title'" />`
    )
    expect(await render(node, { size: 'Large' })).toBe(
      '<div data-size="Large" title="a &quot;quoted&quot; title"></div>'
    )
  })

  test('print v-model with and without an argument', () => {
    const node = vue.element('Toggle', [
      vue.model(es.identifier('pressed')),
      vue.model(es.identifier('open'), 'open')
    ])
    expect(vue.printTemplate(node)).toBe('<Toggle v-model="pressed" v-model:open="open" />')
  })

  test('print a component with script setup, nested template, and scoped style', () => {
    const script = es.parseModule("import { SwitchRoot } from 'reka-ui'")
    const template = vue.element(
      'SwitchRoot',
      [vue.attribute('class', 'switch')],
      [vue.element('span', [], [vue.text('On')])]
    )
    expect(vue.printComponent({ script, template, style: '.switch { width: 40px; }' })).toBe(
      [
        '<script setup lang="ts">',
        "import { SwitchRoot } from 'reka-ui';",
        '</script>',
        '',
        '<template>',
        '  <SwitchRoot class="switch">',
        '    <span>On</span>',
        '  </SwitchRoot>',
        '</template>',
        '',
        '<style scoped>',
        '.switch { width: 40px; }',
        '</style>',
        ''
      ].join('\n')
    )
  })
})
