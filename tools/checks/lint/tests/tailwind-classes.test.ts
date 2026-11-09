import { describe, expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-unknown-tailwind-classes'
const rules = { [`open-pencil/${rule}`]: 'error' }
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

describe('no-px-tailwind-values', () => {
  const pxRule = 'no-px-tailwind-values'

  test('rejects pixel lengths in arbitrary values in the app and the SDK', async () => {
    const classes = [
      'text-[11px]',
      'hover:h-[26px]',
      '-bottom-[9px]',
      'grid-cols-[24px_minmax(0,1fr)]',
      'w-[min(360px,100%)]',
      '[width:10px]',
      'w-[10PX]'
    ]
    const accepted = [
      'text-2xs',
      'h-6.5',
      'w-[22.5rem]',
      'rounded-md',
      'w-px',
      'shadow-[0_8px_30px_var(--color-border)]',
      'grid-cols-[repeat(2,1fr)]',
      '[box-shadow:0_1px_2px_var(--color-border)]',
      'after:content-["10px_wide"]'
    ]
    const diagnostics = ruleDiagnostics(
      await lintFiles(
        {
          'src/theme/rejected.ts': `export const theme = '${classes.join(' ')}'\n`,
          'src/theme/accepted.ts': `export const theme = '${accepted.join(' ')}'\n`,
          'packages/vue/src/primitives/Demo/examples/Px.vue': `${SCRIPT}<template><p class="text-[11px]" /></template>\n`,
          'packages/docs/.vitepress/theme/landing/Px.vue': `${SCRIPT}<template><p class="text-[11px]" /></template>\n`
        },
        { [`open-pencil/${pxRule}`]: 'error' }
      ),
      pxRule
    )
    const files = diagnostics.map((item) => item.filename?.split('/').pop())
    expect(files.filter((name) => name === 'rejected.ts')).toHaveLength(classes.length)
    expect(files.filter((name) => name !== 'rejected.ts')).toEqual(['Px.vue'])
    expect(diagnostics.find((item) => item.filename?.endsWith('Px.vue'))?.filename).toContain(
      'packages/vue/src/'
    )
  })
})

describe('no-physical-side-tailwind-classes', () => {
  const sideRule = 'no-physical-side-tailwind-classes'

  test('names the logical class for each utility that names a side', async () => {
    const replacements = {
      'ml-2': 'ms-2',
      '-mr-1': '-me-1',
      'hover:pl-3': 'hover:ps-3',
      'data-[side=left]:pr-[1rem]': 'data-[side=left]:pe-[1rem]',
      'left-0': 'inset-s-0',
      '-right-1/2': '-inset-e-1/2',
      'start-2': 'inset-s-2',
      'border-l-2': 'border-s-2',
      'border-r-border': 'border-e-border',
      'rounded-tl-md': 'rounded-ss-md',
      'rounded-r': 'rounded-e',
      'text-left': 'text-start',
      'float-right': 'float-end'
    }
    const accepted = [
      'ms-2',
      'inset-x-0',
      'space-x-2',
      'divide-x',
      'border-x',
      'mask-l-from-50%',
      'text-center'
    ]
    const diagnostics = ruleDiagnostics(
      await lintFiles(
        {
          'src/theme/rejected.ts': `export const theme = '${Object.keys(replacements).join(' ')}'\n`,
          'src/theme/accepted.ts': `export const theme = '${accepted.join(' ')}'\n`,
          'packages/vue/src/primitives/Demo/examples/Side.vue': `${SCRIPT}<template><p class="ml-2" /></template>\n`,
          'packages/docs/.vitepress/theme/landing/Landing.vue': `${SCRIPT}<template><p class="ml-2" /></template>\n`
        },
        { [`open-pencil/${sideRule}`]: 'error' }
      ),
      sideRule
    )
    const named = diagnostics
      .filter((item) => item.filename?.endsWith('rejected.ts'))
      .map((item) => /use `([^`]+)` instead of `([^`]+)`/.exec(item.message)?.slice(1))
    expect(Object.fromEntries(named.map((pair) => [pair?.[1], pair?.[0]]))).toEqual(replacements)
    expect(
      diagnostics
        .filter((item) => !item.filename?.endsWith('rejected.ts'))
        .map((item) => item.filename?.split('/').pop())
    ).toEqual(['Side.vue'])
  })
})

describe('no-interpolated-tailwind-classes', () => {
  const interpolatedRule = 'no-interpolated-tailwind-classes'

  test('rejects class lists interpolated in themes and class helpers', async () => {
    const diagnostics = ruleDiagnostics(
      await lintFiles(
        {
          'src/theme/spinner.ts': `const spin = 'animate-spin'\nexport default { slots: { spinner: \`size-3.5 \${spin}\` } }\n`,
          'src/components/variants.ts': `import { tv } from 'tailwind-variants'\nconst spin = 'animate-spin'\nexport const ui = tv({ base: \`size-3.5 \${spin}\` })\n`,
          'src/components/merge.ts': `import { twMerge } from 'tailwind-merge'\nconst spin = 'animate-spin'\nexport const merged = twMerge(\`size-3.5 \${spin}\`)\n`,
          'src/components/join.ts': `import { twJoin } from 'tailwind-merge'\nconst spin = 'animate-spin'\nexport const joined = twJoin(\`size-3.5 \${spin}\`)\n`
        },
        { [`open-pencil/${interpolatedRule}`]: 'error' }
      ),
      interpolatedRule
    )
    expect(diagnostics.map((item) => item.filename?.split('/').pop()).toSorted()).toEqual([
      'join.ts',
      'merge.ts',
      'spinner.ts',
      'variants.ts'
    ])
  })

  test('accepts arrays, plain template strings, and interpolation outside class lists', async () => {
    const diagnostics = ruleDiagnostics(
      await lintFiles(
        {
          'src/theme/array.ts':
            "const spin = 'animate-spin'\nexport default { slots: { spinner: ['size-3.5', spin] } }\n",
          'src/theme/plain.ts': 'export default { slots: { root: `size-3.5 shrink-0` } }\n',
          'src/theme/variant-key.ts': `const size = 'sm'\nexport default { slots: { root: 'flex' }, defaultVariants: { size: \`\${size}\` } }\n`,
          'src/components/key.ts': `const id = 'a'\nexport const key = \`\${id}:b\`\n`,
          // CSS values a theme module hands another library are not class lists.
          'src/theme/editor.ts': `import { EditorView } from '@codemirror/view'\nconst gap = 8\nexport const theme = EditorView.theme({ '.cm-line': { padding: \`0 \${gap}px\` } })\n`,
          // Outside a theme module, a template after a helper call is no longer inside it.
          'src/components/after.ts': `import { tv } from 'tailwind-variants'\nconst id = 'a'\nexport const ui = tv({ base: 'flex' })\nexport const key = \`\${id}:b\`\n`
        },
        { [`open-pencil/${interpolatedRule}`]: 'error' }
      ),
      interpolatedRule
    )
    expect(diagnostics).toEqual([])
  })
})
