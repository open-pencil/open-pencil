import { expect, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { useFontPicker } from '@open-pencil/vue/primitives/FontPicker'

test('a search lists the family it names first, then families it begins, as Figma does', async () => {
  const picker = useFontPicker({
    modelValue: ref('Inter'),
    listFamilies: async () => ['Explora', 'Grandiflora One', 'Inter', 'Lora', 'Lora Serif']
  })
  picker.open.value = true
  await nextTick()
  for (let tick = 0; tick < 5 && picker.loading.value; tick++) await Promise.resolve()
  picker.searchTerm.value = 'lora'
  expect(picker.filtered.value.map((option) => option.family)).toEqual([
    'Lora',
    'Lora Serif',
    'Explora',
    'Grandiflora One'
  ])
})
