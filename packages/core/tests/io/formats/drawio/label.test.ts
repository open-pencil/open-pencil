import { expect, test } from 'bun:test'

import { readLabel, type LabelFormat } from '#core/io/formats/drawio/label'

const BASE: LabelFormat = {
  bold: false,
  italic: false,
  underline: false,
  size: 12,
  color: { r: 0, g: 0, b: 0, a: 1 },
  family: 'Inter'
}

test('an HTML label reads as a browser shows it, with runs where its tags change the style', () => {
  const label = readLabel(
    '<div>Line&nbsp;one</div><div><b>Bold</b> and <i style="color:#ff0000">red</i><br>last &amp; <span style="font-size:20px">big</span></div>',
    true,
    BASE
  )
  expect(label.text).toBe('Line one\nBold and red\nlast & big')
  expect(label.runs).toEqual([
    { start: 9, length: 4, style: { fontWeight: 700 } },
    { start: 18, length: 3, style: { italic: true, fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }] } },
    { start: 29, length: 3, style: { fontSize: 20 } }
  ])
})

test('a plain label is its text, its markup included', () => {
  expect(readLabel('a <b> c', false, BASE)).toEqual({ text: 'a <b> c', runs: [] })
})
