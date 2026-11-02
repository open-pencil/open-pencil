import { expect, test } from 'bun:test'

import { facesFromStyles, nearestFamilyFace } from '@open-pencil/core/text'

// Lora's faces as Figma desktop 126 lists them.
const lora = facesFromStyles([
  'Regular',
  'Medium',
  'SemiBold',
  'Bold',
  'Italic',
  'Medium Italic',
  'SemiBold Italic',
  'Bold Italic'
])

test('reads faces from style names, once each, keeping each name', () => {
  expect(facesFromStyles(['Bold', 'Bold', 'Light Italic', 'Extra Light'])).toEqual([
    { weight: 700, italic: false, style: 'Bold' },
    { weight: 300, italic: true, style: 'Light Italic' },
    { weight: 200, italic: false, style: 'Extra Light' }
  ])
})

test('the nearest face keeps the slant, as Figma picks one on a family switch', () => {
  expect(nearestFamilyFace(lora, 100, false)).toMatchObject({ weight: 400, italic: false })
  expect(nearestFamilyFace(lora, 900, false)).toMatchObject({ weight: 700, italic: false })
  expect(nearestFamilyFace(lora, 500, true)).toMatchObject({ weight: 500, italic: true })
  expect(nearestFamilyFace(lora, 900, true)).toMatchObject({ style: 'Bold Italic' })
})

test('a family without the slant gives the nearest weight, and a tie takes the lighter', () => {
  const upright = facesFromStyles(['Regular', 'SemiBold'])
  expect(nearestFamilyFace(upright, 700, true)).toMatchObject({ weight: 600, italic: false })
  expect(nearestFamilyFace(upright, 500, false)).toMatchObject({ weight: 400, italic: false })
  expect(nearestFamilyFace([], 400, false)).toBeNull()
})
