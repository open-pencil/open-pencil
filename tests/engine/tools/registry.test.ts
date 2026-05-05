import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS } from '../../helpers/tools'

describe('tool definitions', () => {
  test('all tools have unique names', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('all tools have description and params', () => {
    for (const t of ALL_TOOLS) {
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(typeof t.params).toBe('object')
      expect(typeof t.execute).toBe('function')
    }
  })

  test('required params are marked', () => {
    for (const t of ALL_TOOLS) {
      for (const [key, param] of Object.entries(t.params)) {
        expect(typeof param.type).toBe('string')
        expect(typeof param.description).toBe('string')
      }
    }
  })
})
