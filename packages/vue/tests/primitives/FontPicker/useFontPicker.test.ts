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

test('reopening lists the families again, with a font installed meanwhile', async () => {
  const installed = ['Inter', 'Lora']
  const picker = useFontPicker({
    modelValue: ref('Inter'),
    listFamilies: async () => [...installed]
  })
  const settle = async () => {
    await nextTick()
    for (let tick = 0; tick < 5 && picker.loading.value; tick++) await Promise.resolve()
  }
  picker.open.value = true
  await settle()
  picker.open.value = false
  await settle()
  installed.push('Caveat')
  picker.open.value = true
  await settle()
  expect(picker.filtered.value.map((option) => option.family)).toEqual(['Inter', 'Lora', 'Caveat'])
})
