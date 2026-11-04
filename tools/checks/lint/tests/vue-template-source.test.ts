import { expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const SCRIPT = '<script setup lang="ts">\nconst id = "save"\n</script>\n'

// Oxlint hands JS plugins only a component's <script>; template rules read the rest from the file.
test('template rules see the template of a component Oxlint lints', async () => {
  const rule = 'no-native-title-attributes-in-vue'
  const diagnostics = await lintFiles(
    {
      'src/components/SaveButton.vue': `${SCRIPT}<template><button title="Save">{{ id }}</button></template>\n`
    },
    { [`open-pencil/${rule}`]: 'error' }
  )
  expect(ruleDiagnostics(diagnostics, rule)).toHaveLength(1)
})

test('a dynamic test id goes through v-test-id on an element and stays an attribute on a component', async () => {
  const rule = 'no-dynamic-data-test-id-in-vue'
  const diagnostics = await lintFiles(
    {
      'src/components/OnElement.vue': `${SCRIPT}<template><span :data-test-id="id" /></template>\n`,
      'src/components/OnComponent.vue': `${SCRIPT}<template><AppSelect :data-test-id="id" /></template>\n`
    },
    { [`open-pencil/${rule}`]: 'error' }
  )
  const files = ruleDiagnostics(diagnostics, rule).map((item) => item.filename?.split('/').pop())
  expect(files).toEqual(['OnElement.vue'])
})
