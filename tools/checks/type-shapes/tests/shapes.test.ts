import { describe, expect, test } from 'bun:test'

import { duplicateShapes } from '../src/shapes'

/** The names of each duplicate group, so a test reads which shapes matched. */
function duplicates(...sources: [path: string, text: string, named?: boolean][]): string[][] {
  return duplicateShapes(sources.map(([path, text, named = true]) => [path, text, named])).map(
    (locations) => locations.map((location) => location.name)
  )
}

describe('duplicate type shapes', () => {
  test('finds a named shape declared twice, members in any order', () => {
    expect(
      duplicates(
        ['src/a.ts', 'interface Size { width: number; height: number }'],
        ['src/b.ts', 'type Box = { height: number; width: number }']
      )
    ).toEqual([['Size', 'Box']])
  })

  test('tells shapes apart by their methods too', () => {
    expect(
      duplicates(
        ['src/a.ts', 'interface A { id: string; reset(): void }'],
        ['src/b.ts', 'interface B { id: string; clear(): void }']
      )
    ).toEqual([])
  })

  test('finds an inline intersection written twice, however small', () => {
    expect(
      duplicates([
        'packages/core/src/a.ts',
        'let a: Node & { y: number }\nlet b: Array<Node & { y: number }>'
      ])
    ).toEqual([['Node & { y: number }', 'Node & { y: number }']])
  })

  test('finds an inline intersection that repeats a named one', () => {
    expect(
      duplicates([
        'src/a.ts',
        'type Placed = Node & { y: number }\nfunction f(node: Node & { y: number }) {}'
      ])
    ).toEqual([['Placed', 'Node & { y: number }']])
  })

  test('compares inline intersections within a package, and in every package', () => {
    const intersection = 'let a: Node & { y: number }'
    expect(
      duplicates(
        ['packages/fig/src/a.ts', intersection, false],
        ['packages/kiwi/src/b.ts', intersection, false]
      )
    ).toEqual([])
    expect(
      duplicates(
        ['packages/fig/src/a.ts', intersection, false],
        ['packages/fig/src/b.ts', intersection, false]
      )
    ).toHaveLength(1)
  })

  test('compares named shapes only where asked', () => {
    expect(
      duplicates(
        ['packages/kiwi/src/a.ts', 'interface Vector { x: number; y: number }', false],
        ['packages/scene-graph/src/b.ts', 'interface Vector { x: number; y: number }', false]
      )
    ).toEqual([])
  })

  test('tells function and method signatures apart by their types and optional parameters', () => {
    expect(
      duplicates([
        'src/a.ts',
        'let a: Node & { map: (x: string) => string }\nlet b: Node & { map: (x: number) => number }'
      ])
    ).toEqual([])
    expect(
      duplicates([
        'src/a.ts',
        'let a: Node & { run(value: string): void }\nlet b: Node & { run(value?: string): void }'
      ])
    ).toEqual([])
    // Parameter names don't change the contract.
    expect(
      duplicates([
        'src/a.ts',
        'let a: Node & { run(value: string): void }\nlet b: Node & { run(input: string): void }'
      ])
    ).toHaveLength(1)
  })

  test('reads a parenthesized part of an intersection as the part itself', () => {
    expect(
      duplicates(['src/a.ts', 'let a: Node & ({ y: number })\nlet b: Node & { y: number }'])
    ).toHaveLength(1)
  })

  test('keeps each tool its own workspace', () => {
    const intersection = 'let a: Node & { y: number }'
    expect(
      duplicates(
        ['tools/checks/type-shapes/src/a.ts', intersection, false],
        ['tools/checks/docs/src/b.ts', intersection, false]
      )
    ).toEqual([])
  })
})
