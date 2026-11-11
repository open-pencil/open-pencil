import { expect, test } from 'bun:test'

import { useLivePageSelection } from '@/app/live-pages/selection'

test('a pick belongs to the frame whose page reported it', () => {
  const { setSelection, selectionOf } = useLivePageSelection()

  setSelection('frame-a', { file: 'src/pages/index.vue', line: 7 })

  expect(selectionOf('frame-a')).toEqual({ file: 'src/pages/index.vue', line: 7 })
  expect(selectionOf('frame-b')).toBeNull()
  expect(selectionOf(null)).toBeNull()
})

test('a frame that reported nothing leaves the panel without a location', () => {
  const { setSelection, selectionOf } = useLivePageSelection()
  setSelection('frame-a', { file: 'src/App.vue' })

  setSelection('frame-a', null)

  expect(selectionOf('frame-a')).toBeNull()
})
