import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, toolTakesFilePath } from '@open-pencil/core/tools'

/** Tools whose `path` argument is geometry, not a file name. */
const PATH_IS_DATA = ['create_vector', 'path_set']

describe('toolTakesFilePath', () => {
  test('is true for file-output tools and for tools with a filesystem capability', () => {
    expect(toolTakesFilePath({ capabilities: ['document:read'], fileOutput: true })).toBe(true)
    expect(toolTakesFilePath({ capabilities: ['document:read', 'filesystem:write'] })).toBe(true)
    expect(toolTakesFilePath({ capabilities: ['filesystem:read'] })).toBe(true)
  })

  test('is false for a tool whose path is data', () => {
    expect(toolTakesFilePath({ capabilities: ['document:write'] })).toBe(false)
    expect(toolTakesFilePath({ capabilities: ['document:write'], fileOutput: false })).toBe(false)
  })

  test('marks the tools that write their result to a file', () => {
    const fileTools = ALL_TOOLS.filter(toolTakesFilePath).map((def) => def.name)
    expect(fileTools.toSorted()).toEqual(['export_image', 'export_pdf', 'export_svg', 'get_jsx'])
  })

  test('every tool with a path argument is a file tool or carries path as data', () => {
    const withPath = ALL_TOOLS.filter((def) => 'path' in def.input.entries)
    const unclassified = withPath
      .filter((def) => !toolTakesFilePath(def) && !PATH_IS_DATA.includes(def.name))
      .map((def) => def.name)
    expect(unclassified).toEqual([])
    for (const name of PATH_IS_DATA) {
      const def = ALL_TOOLS.find((candidate) => candidate.name === name)
      expect(def && toolTakesFilePath(def)).toBe(false)
    }
  })
})
