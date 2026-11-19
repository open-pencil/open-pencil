import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

const theme = (background: string) =>
  JSON.stringify({
    color: {
      $type: 'color',
      background: { $value: background },
      surface: { $value: '{color.background}' }
    },
    space: { md: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } }
  })

/** A CLI `tokens --format dtcg` export: a resolver at the root, one file per mode below it. */
async function writeDtcgExport(root: string) {
  const resolver = {
    version: '2025-11-01',
    sets: {
      Primitive: { sources: [{ $ref: 'Primitive/Mode 1.tokens.json' }] },
      Layout: { sources: [{ $ref: 'Layout/Mode 1.tokens.json' }] }
    },
    modifiers: {
      Theme: {
        contexts: {
          Light: [{ $ref: 'Theme/Light.tokens.json' }],
          Dark: [{ $ref: 'Theme/Dark.tokens.json' }]
        },
        default: 'Light'
      }
    },
    resolutionOrder: [
      { $ref: '#/sets/Primitive' },
      { $ref: '#/sets/Layout' },
      { $ref: '#/modifiers/Theme' }
    ]
  }
  const mode = (collection: string, modeName: string, isDefault = true) => ({
    $extensions: { 'dev.openpencil': { collection, mode: modeName, default: isDefault } }
  })
  const entries: Array<[string, unknown]> = [
    ['tokens.resolver.json', resolver],
    [
      'Primitive/Mode 1.tokens.json',
      {
        color: { $type: 'color', brand: { $value: '#2563eb' } },
        ...mode('Primitive', 'Mode 1')
      }
    ],
    [
      'Layout/Mode 1.tokens.json',
      {
        space: { $type: 'dimension', md: { $value: { value: 8, unit: 'px' } } },
        ...mode('Layout', 'Mode 1')
      }
    ],
    [
      'Theme/Light.tokens.json',
      {
        color: { $type: 'color', surface: { $value: '#ffffff' } },
        ...mode('Theme', 'Light')
      }
    ],
    [
      'Theme/Dark.tokens.json',
      {
        color: { $type: 'color', surface: { $value: '#09090b' } },
        ...mode('Theme', 'Dark', false)
      }
    ]
  ]
  for (const [path, content] of entries) {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, JSON.stringify(content))
  }
}

test('design token files import as a collection with a mode per file', async () => {
  await editor.page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = editor.page.getByTestId('variables-dialog')
  await expect(dialog).toBeVisible()

  const chooser = editor.page.waitForEvent('filechooser')
  await dialog.getByTestId('variables-import-tokens').click()
  await (
    await chooser
  ).setFiles([
    {
      name: 'Light.tokens.json',
      mimeType: 'application/json',
      buffer: Buffer.from(theme('#ffffff'))
    },
    {
      name: 'Dark.tokens.json',
      mimeType: 'application/json',
      buffer: Buffer.from(theme('#09090b'))
    }
  ])

  const importDialog = editor.page.getByTestId('variables-import-dialog')
  await expect(importDialog.getByTestId('variables-import-summary')).toHaveText(
    '3 to add · 0 to update · 0 skipped'
  )
  await importDialog.getByTestId('variables-import-confirm').click()
  await expect(importDialog).toBeHidden()

  await expect(dialog.getByTestId('variable-row')).toHaveCount(3)
  const stylesheet = dialog.getByTestId('token-output')
  await expect(stylesheet).toContainText('--spacing-md: 1rem')
  // Each file is a mode: the second one's value goes under its condition.
  await expect(stylesheet).toContainText(/="dark"\][^}]*--color-background: #09090b/i)

  // The whole import is one step on the document's history.
  await dialog.getByTestId('variable-row').first().click()
  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await expect(dialog.getByTestId('variable-row')).toHaveCount(0)
  editor.canvas.assertNoErrors()
})

test('a dtcg export folder imports through its resolver', async () => {
  const folder = test.info().outputPath('tokens-output')
  await writeDtcgExport(folder)

  await editor.page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  const dialog = editor.page.getByTestId('variables-dialog')
  await expect(dialog).toBeVisible()

  const chooser = editor.page.waitForEvent('filechooser')
  await dialog.getByTestId('variables-import-tokens-folder').click()
  await (await chooser).setFiles(folder)

  const importDialog = editor.page.getByTestId('variables-import-dialog')
  await expect(importDialog.getByTestId('variables-import-summary')).toHaveText(
    '3 to add · 0 to update · 0 skipped'
  )
  await importDialog.getByTestId('variables-import-confirm').click()
  await expect(importDialog).toBeHidden()

  // The resolver's refs all resolved: one collection per set and modifier, each holding
  // the tokens of the files it refers to. One collection's variables show at a time.
  await expect(dialog.getByRole('button', { name: 'Primitive 1' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Layout 1' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Theme 1' })).toBeVisible()
  await expect(dialog.getByTestId('variable-row')).toHaveCount(1)
  const stylesheet = dialog.getByTestId('token-output')
  await expect(stylesheet).toContainText(/--color-brand: #2563eb/i)

  await dialog.getByRole('button', { name: 'Layout 1' }).click()
  await expect(dialog.getByTestId('variable-row')).toHaveCount(1)
  await expect(stylesheet).toContainText('--spacing-md: 8px')

  await dialog.getByRole('button', { name: 'Theme 1' }).click()
  await expect(dialog.getByTestId('variable-row')).toHaveCount(1)
  // Theme's second mode holds the dark value.
  await expect(stylesheet).toContainText(/="dark"\][^}]*--color-surface: #09090b/i)
  editor.canvas.assertNoErrors()
})
