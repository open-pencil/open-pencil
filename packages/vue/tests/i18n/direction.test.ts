import { expect, test } from 'bun:test'

import { directedTranslations } from '#vue/i18n/direction'

const RLM = String.fromCodePoint(0x200f)
const FSI = String.fromCodePoint(0x2068)
const PDI = String.fromCodePoint(0x2069)

test('right-to-left messages keep their punctuation at their own ends and isolate what goes into them', () => {
  const translations = {
    common: {
      saved: 'تم الحفظ.',
      files: { one: 'ملف واحد', other: '{count} ملف' },
      empty: ''
    }
  }
  expect(directedTranslations('ar', translations)).toEqual({
    common: {
      saved: `${RLM}تم الحفظ.${RLM}`,
      files: { one: `${RLM}ملف واحد${RLM}`, other: `${RLM}${FSI}{count}${PDI} ملف${RLM}` },
      empty: ''
    }
  })
})

test('left-to-right translations stay as written', () => {
  const translations = { common: { saved: 'Gespeichert.' } }
  expect(directedTranslations('de', translations)).toEqual(translations)
})
