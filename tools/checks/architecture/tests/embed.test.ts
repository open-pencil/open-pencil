import { describe, expect, test } from 'bun:test'

import { embedImportViolation } from '../src/steiger-rules/embed'

describe('embed imports', () => {
  test('allow public packages, their libraries, and the embed’s own modules', () => {
    expect(
      embedImportViolation('src/views/embed/EmbedView.vue', '@open-pencil/vue', null)
    ).toBeNull()
    expect(embedImportViolation('src/app/embed/document.ts', 'vue', null)).toBeNull()
    expect(
      embedImportViolation(
        'src/views/embed/EmbedView.vue',
        '@/app/embed/editor',
        'src/app/embed/editor.ts'
      )
    ).toBeNull()
    expect(
      embedImportViolation('src/app/embed/document.ts', './editor', 'src/app/embed/editor.ts')
    ).toBeNull()
  })

  test('refuse other app code, which belongs in a package first', () => {
    expect(
      embedImportViolation(
        'src/views/embed/EmbedView.vue',
        '@/components/ui/button/AppButton.vue',
        'src/components/ui/button/AppButton.vue'
      )
    ).toContain('public packages')
    expect(
      embedImportViolation(
        'src/app/embed/document.ts',
        '@/app/shell/ui',
        'src/app/shell/ui/index.ts'
      )
    ).toContain('public packages')
    expect(
      embedImportViolation(
        'src/app/embed/document.ts',
        '/src/app/shell/ui/index.ts',
        'src/app/shell/ui/index.ts'
      )
    ).toContain('public packages')
  })

  test('leave the rest of the app alone', () => {
    expect(embedImportViolation('src/app/cloud/links.ts', '@/app/shell/ui', null)).toBeNull()
  })
})
