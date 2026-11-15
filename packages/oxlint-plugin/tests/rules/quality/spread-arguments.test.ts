import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = '@open-pencil/data/no-spread-arguments'
const rules = { [rule]: 'error' }

describe('@open-pencil/data/no-spread-arguments', () => {
  test.each([
    'pending.push(...node.childIds)',
    'list.unshift(...items)',
    'list.splice(0, 0, ...items)',
    'list.push(first, ...rest)',
    'Math.max(...values)',
    'Math.min(0, ...nodes.map((node) => node.x))',
    'String.fromCharCode(...bytes)',
    'String.fromCodePoint(...codes)',
    'list.push(...[...items])',
    'Math.max(...[0, ...values])'
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(`${source}\n`, rules), rule)).toHaveLength(1)
  })

  test.each([
    'for (const id of node.childIds) pending.push(id)',
    'list.push(...[a, b])',
    'Math.max(...[width, height])',
    'Math.max(a, b)',
    'forward(...args)',
    'const copy = [...items]',
    'console.log(...messages)'
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(`${source}\n`, rules), rule)).toHaveLength(0)
  })
})
