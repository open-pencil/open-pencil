import type * as AppTabs from '@/app/tabs'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test')

test('shows preparation status in an inactive tab without covering the active canvas', async () => {
  await editor.page.evaluate(async () => {
    const tabsURL = '/src/app/tabs/index.ts'
    const tabs: typeof AppTabs = await import(tabsURL)
    const first = tabs.getActiveStore()
    first.state.documentName = 'Preparing file'
    tabs.createTab()
    first.preparationController
      .begin({ kind: 'document-open', phase: 'resolving-fonts', subject: 'preparing.fig' })
      .update({ phase: 'resolving-fonts', completed: 3, total: 4, unit: 'fonts' })
  })

  const tab = editor.page.getByTestId('tabbar-tab').filter({ hasText: 'Preparing file' })
  await expect(tab.getByRole('progressbar', { name: 'Preparing document' })).toHaveAttribute(
    'aria-valuenow',
    '75'
  )
  await expect(editor.page.getByTestId('canvas-loading')).toBeHidden()
})
