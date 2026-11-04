import { expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

const RULE = 'no-overlay-content-from-open-state'
const SCRIPT = '<script setup lang="ts">\nconst removing = null\nconst shown = null\n</script>\n'

async function flagged(files: Record<string, string>): Promise<string[]> {
  const diagnostics = await lintFiles(files, { [`open-pencil/${RULE}`]: 'error' })
  return ruleDiagnostics(diagnostics, RULE)
    .map((item) => item.filename?.split('/').pop() ?? '')
    .sort()
}

test('flags an overlay that draws the state its open tests for presence', async () => {
  expect(
    await flagged({
      'src/components/Cleared.vue': `${SCRIPT}<template><AppConfirmationDialog :open="removing !== null" :heading="removing?.name" @update:open="removing = null" /></template>\n`,
      'src/components/Slot.vue': `${SCRIPT}<template><AppDialogRoot :open="!!removing"><p>{{ removing.name }}</p></AppDialogRoot></template>\n`,
      'src/components/Held.vue': `${SCRIPT}<template><AppConfirmationDialog :open="removing !== null" :heading="shown?.name" @confirm="remove(removing)" @update:open="removing = null" /></template>\n`
    })
  ).toEqual(['Cleared.vue', 'Slot.vue'])
})

test('leaves overlays whose open is not a presence test', async () => {
  expect(
    await flagged({
      'src/components/List.vue': `${SCRIPT}<template><Disclosure v-for="group in groups" :open="expanded.includes(group.id)">{{ group.name }}</Disclosure></template>\n`,
      'src/components/Context.vue': `${SCRIPT}<template><ComboboxRoot :open="ctx.open">{{ ctx.label }}</ComboboxRoot></template>\n`,
      // Popovers close at once, so nothing draws after their state clears.
      'src/components/Popover.vue': `${SCRIPT}<template><PopoverRoot :open="!!removing">{{ removing.name }}</PopoverRoot></template>\n`
    })
  ).toEqual([])
})

test('flags an overlay opened by v-if instead of :open', async () => {
  expect(
    await flagged({
      'src/components/Mounted.vue': `${SCRIPT}<template><RecoveryCodes v-if="removing" :open="true" :codes="shown" /></template>\n`
    })
  ).toEqual(['Mounted.vue'])
})
