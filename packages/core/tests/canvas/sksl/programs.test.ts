import { describe, expect, test } from 'bun:test'

import { getCanvasKit } from '@open-pencil/core/canvaskit'

// Loads every module the renderer draws with, and so defines every program it can use.
import '#core/canvas/renderer'
import { compileProgram, definedPrograms } from '#core/canvas/sksl'

const ck = await getCanvasKit()
const programs = definedPrograms()

describe('SkSL programs', () => {
  test('the renderer defines each of its programs once, under its own name', () => {
    const names = programs.map((program) => program.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual(
      expect.arrayContaining([
        'diamond gradient',
        'pixel grid',
        'dot grid',
        'plus darker blender',
        'plus lighter blender',
        'glass refraction',
        'glass light'
      ])
    )
  })

  test.each(programs.map((program) => [program.name, program] as const))(
    '%s compiles',
    (_, program) => {
      compileProgram(ck, program).effect.delete()
    }
  )
})
