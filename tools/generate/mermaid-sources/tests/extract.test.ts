import { expect, test } from 'bun:test'

import { extractDeclarations, hasImports } from '#mermaid-sources/extract'

const MODULE = `import { other } from './other'

/** Says hello. */
const hello = (name: string) => 'hello ' + name

export const goodbye = function (name: string): string {
  return 'goodbye ' + name
}

function helper() {}
`

test('copies declarations as written, with their comments, exported', () => {
  expect(extractDeclarations(MODULE, 'm.ts', ['hello', 'goodbye', 'helper'])).toEqual([
    "/** Says hello. */\nexport const hello = (name: string) => 'hello ' + name",
    "export const goodbye = function (name: string): string {\n  return 'goodbye ' + name\n}",
    'export function helper() {}'
  ])
})

test('fails when a release no longer declares a name, rather than copying something else', () => {
  expect(() => extractDeclarations(MODULE, 'm.ts', ['farewell'])).toThrow(
    'm.ts no longer declares farewell'
  )
})

test('tells modules that import others from ones that can be copied whole', () => {
  expect(hasImports(MODULE, 'm.ts')).toBe(true)
  expect(hasImports('export const a = 1\n', 'a.ts')).toBe(false)
})
