import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import {
  mergeVariableModeClaims,
  mergeVariableModeMaps,
  variableModeLayer
} from '#fig/node-change/variable/maps'

const SIZES = 3
const THEME = 8
const COMPACT = 10
const WIDE = 11
const DARK = 13

function entry(collection: number, mode?: number) {
  return mode === undefined
    ? { variableSetID: { guid: guid(collection) } }
    : { variableSetID: { guid: guid(collection) }, variableModeID: guid(mode) }
}

function modeMap(...entries: ReturnType<typeof entry>[]) {
  return { variableModeBySetMap: { entries } }
}

test('a mode replaces the mode of its own collection only', () => {
  const merged = mergeVariableModeMaps(
    modeMap(entry(SIZES, WIDE), entry(THEME, DARK)),
    modeMap(entry(SIZES, COMPACT))
  )
  expect(merged).toEqual(modeMap(entry(SIZES, COMPACT), entry(THEME, DARK)))
})

test('an entry without a mode clears its collection', () => {
  const merged = mergeVariableModeMaps(
    modeMap(entry(SIZES, WIDE), entry(THEME, DARK)),
    modeMap(entry(SIZES))
  )
  expect(merged).toEqual(modeMap(entry(THEME, DARK)))
})

test('a record without a mode map leaves the modes alone', () => {
  expect(mergeVariableModeMaps(modeMap(entry(SIZES, WIDE)), {})).toEqual({})
})

test('an entry whose collection is not resolved is kept', () => {
  const unresolved = { variableSetID: {}, variableModeID: guid(WIDE) }
  const merged = mergeVariableModeMaps(modeMap(entry(SIZES, WIDE)), {
    variableModeBySetMap: { entries: [unresolved] }
  })
  expect(merged).toEqual({ variableModeBySetMap: { entries: [entry(SIZES, WIDE), unresolved] } })
})

test('a mode layer marks a cleared collection without a mode', () => {
  const layer = variableModeLayer(modeMap(entry(SIZES, WIDE), entry(THEME)))
  expect([...layer]).toEqual([
    [`1:${SIZES}`, `1:${WIDE}`],
    [`1:${THEME}`, undefined]
  ])
})

test('claims combine per collection and keep a cleared collection', () => {
  const merged = mergeVariableModeClaims(
    modeMap(entry(SIZES, WIDE), entry(THEME, DARK)),
    modeMap(entry(SIZES), entry(THEME, DARK))
  )
  expect(merged).toEqual(modeMap(entry(SIZES), entry(THEME, DARK)))
})
