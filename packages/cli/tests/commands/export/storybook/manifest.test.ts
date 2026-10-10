import { describe, expect, test } from 'bun:test'

import { isGeneratedPath } from '#cli/commands/export/storybook/manifest'

describe('Storybook export manifest paths', () => {
  test('are every file the export writes', () => {
    for (const path of [
      'Button.stories.ts',
      'Button.vue',
      'Button.tsx',
      'Button.module.css',
      'Button.design/Default.png',
      'openpencil/kit-design/fonts.css',
      'openpencil/kit-design/tokens.css',
      'openpencil/kit-design/fonts/inter-400-normal.woff2'
    ])
      expect(isGeneratedPath(path)).toBe(true)
  })

  test('never reach outside the output folder or files the export does not write', () => {
    for (const path of [
      '../Button.stories.ts',
      '/tmp/Button.vue',
      'src/../../Button.tsx',
      'components/Button.vue',
      'openpencil/kit/notes.txt',
      'Button.design/../../x.png'
    ])
      expect(isGeneratedPath(path)).toBe(false)
  })
})
