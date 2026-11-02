import { describe, expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-unknown-tailwind-classes'
const rules = { [`lawha/${rule}`]: 'error' }
const SCRIPT = '<script setup lang="ts">\nconst ok = true\n</script>\n'

/** One fixture per case, each in a theme module, so one Oxlint run checks them all. */
async function themeDiagnostics(classes: readonly string[]) {
  const sources = Object.fromEntries(
    classes.map((className, index) => [
      `src/theme/case-${index}.ts`,
      `export const theme = '${className}'\n`
    ])
  )
  const diagnostics = ruleDiagnostics(await lintFiles(sources, rules), rule)
  return classes.map((_, index) =>
    diagnostics.filter((item) => item.filename?.endsWith(`case-${index}.ts`))
  )
}

describe('no-unknown-tailwind-classes', () => {
  const rejected = [
    'text-danger',
    'hover:border-border-strong',
    'data-[state=open]:text-foreground',
    'bg-red-600',
    'text-sky-400/80',
    'text-[var(--color-warning)]',
    'flex-colm',
    'text-404',
    'text-small',
    'text-(--color-warning)',
    'text-(--color-missing)'
  ]
  const accepted = [
    'text-surface',
    'bg-panel',
    'border-warning/40',
    'hover:bg-error-fill',
    'text-white',
    'bg-transparent',
    'text-xs',
    'text-left',
    'border-b',
    'border-t-2',
    'border-dashed',
    'ring-1',
    'ring-inset',
    'outline-none',
    'outline-offset-2',
    'bg-cover',
    'bg-[image:linear-gradient(red,blue)]',
    'text-[11px]',
    'divide-y',
    'fill-current',
    'group',
    'cm-layer-tag'
  ]

  test('rejects classes Tailwind cannot build from the theme', async () => {
    const results = await themeDiagnostics(rejected)
    expect(results.map((items) => items.length)).toEqual(rejected.map(() => 1))
  })

  test("accepts theme colors, other utilities, and classes that are not Tailwind's", async () => {
    const results = await themeDiagnostics(accepted)
    expect(results.map((items) => items.length)).toEqual(accepted.map(() => 0))
  })

  test('checks Vue class attributes and bindings, and class helpers outside the theme', async () => {
    const diagnostics = ruleDiagnostics(
      await lintFiles(
        {
          'src/components/Static.vue': `${SCRIPT}<template><p class="text-danger" /></template>\n`,
          'src/components/Bound.vue': `${SCRIPT}<template><p :class="[ok && 'text-surface', 'bg-amber-500']" /></template>\n`,
          'src/components/variants.ts':
            "import { tv } from 'tailwind-variants'\nexport const ui = tv({ base: 'text-foreground' })\n",
          'src/components/ids.ts': "export const ID = 'fill-picker-tab-image'\n"
        },
        rules
      ),
      rule
    )
    const files = diagnostics.map((item) => item.filename?.split('/').pop())
    expect(files.toSorted()).toEqual(['Bound.vue', 'Static.vue', 'variants.ts'])
  })
})

test('checks SDK examples and the landing against the docs stylesheet that builds them', async () => {
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      {
        // The docs stylesheet takes the app's tokens, which leave Tailwind's palette out.
        'packages/vue/src/primitives/Demo/examples/AppToken.vue': `${SCRIPT}<template><p class="bg-panel text-[var(--vp-c-text-1)]" /></template>\n`,
        'packages/vue/src/primitives/Demo/examples/Palette.vue': `${SCRIPT}<template><p class="bg-violet-600" /></template>\n`,
        'packages/docs/.vitepress/theme/landing/Section.vue': `${SCRIPT}<template><p class="text-surface" /></template>\n`
      },
      rules
    ),
    rule
  )
  expect(diagnostics.map((item) => item.filename?.split('/').pop())).toEqual(['Palette.vue'])
})
