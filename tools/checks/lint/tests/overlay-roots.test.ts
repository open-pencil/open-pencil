import { expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const RULE = 'no-raw-overlay-roots-in-app'

async function flagged(files: Record<string, string>): Promise<string[]> {
  const diagnostics = await lintFiles(files, { [`open-pencil/${RULE}`]: 'error' })
  return ruleDiagnostics(diagnostics, RULE)
    .map((item) => item.message)
    .sort()
}

const component = (imports: string) =>
  `<script setup lang="ts">\nimport { ${imports} } from 'reka-ui'\n</script>\n<template><div /></template>\n`

test('flags Reka overlay roots imported by app code', async () => {
  expect(
    await flagged({
      'src/components/Menu.vue': component('DropdownMenuRoot, DropdownMenuTrigger'),
      'src/components/Field.vue': component('SelectRoot')
    })
  ).toEqual([
    "Use AppDropdownMenuRoot from src/components/ui instead of Reka's DropdownMenuRoot, so it counts as an open overlay.",
    "Use AppSelectRoot from src/components/ui instead of Reka's SelectRoot, so it counts as an open overlay."
  ])
})

test('flags a namespace import of reka-ui in app code', async () => {
  expect(
    await flagged({
      'src/components/Namespace.vue': `<script setup lang="ts">\nimport * as Reka from 'reka-ui'\n</script>\n<template><Reka.PopoverRoot /></template>\n`
    })
  ).toEqual([
    "Import Reka's parts by name, so overlay roots can be told apart from their wrappers."
  ])
})

test('leaves the shared wrappers and the other parts of an overlay', async () => {
  expect(
    await flagged({
      'src/components/ui/overlay/AppPopoverRoot.vue': component('PopoverRoot'),
      'src/components/Popover.vue': component('PopoverContent, PopoverPortal, PopoverTrigger'),
      'src/components/Tip.vue': component('TooltipRoot')
    })
  ).toEqual([])
})
