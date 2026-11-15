import { expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const rule = '@open-pencil/vue/icon-direction'
const SCRIPT = '<script setup lang="ts">\nconst open = true\n</script>\n'
const component = (template: string) => `${SCRIPT}<template>${template}</template>\n`

test('requires left- and right-pointing icons in the app and the SDK to declare a direction', async () => {
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      {
        'src/components/Bare.vue': component('<icon-lucide-chevron-right class="size-3" />'),
        'src/components/Component.vue': component('<IconArrowLeft />'),
        'src/components/Panel.vue': component('<icon-lucide-panel-left />'),
        'src/components/Wrong.vue': component('<icon-lucide-chevron-left data-direction="left" />'),
        'packages/vue/src/primitives/Demo/Demo.vue': component('<icon-lucide-chevrons-right />'),
        'src/components/Reading.vue': component(
          '<icon-lucide-chevron-right data-direction="reading" :class="open && \'rotate-90\'" />'
        ),
        'src/components/Physical.vue': component(
          '<icon-lucide-arrow-right data-direction="physical" />'
        ),
        'src/components/Other.vue': component(
          '<icon-lucide-chevron-down /><icon-lucide-arrow-right-to-line /><icon-lucide-align-left />'
        ),
        'packages/docs/.vitepress/theme/landing/Landing.vue': component(
          '<icon-lucide-chevron-right />'
        )
      },
      { [rule]: 'error' }
    ),
    rule
  )
  expect(diagnostics.map((item) => item.filename?.split('/').pop()).toSorted()).toEqual([
    'Bare.vue',
    'Component.vue',
    'Demo.vue',
    'Panel.vue',
    'Wrong.vue'
  ])
})
