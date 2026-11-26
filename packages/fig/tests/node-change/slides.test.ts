import { expect, test } from 'bun:test'

import { extractSlideSettings } from '#fig/node-change/slides'

test('notes put each item of a nested list on a line of its own', () => {
  const text = (value: string) => ({ type: 'text', text: value })
  const item = (...children: unknown[]) => ({ type: 'listitem', children })
  const list = (...children: unknown[]) => ({ type: 'list', children })
  const root = {
    type: 'root',
    children: [
      list(item(text('A')), item(list(item(text('B')), item(text('C'))))),
      { type: 'paragraph', children: [text('D'), { type: 'linebreak' }, text('E')] }
    ]
  }
  const settings = extractSlideSettings({
    type: 'SLIDE',
    slideSpeakerNotes: JSON.stringify({ root })
  })
  expect(settings?.notes).toBe('A\nB\nC\nD\nE')
})
