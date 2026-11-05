import { expect, test } from 'bun:test'

import { multiLineRuns } from '#workflows/steps'

test('accepts one-line and folded runs', () => {
  const workflow = [
    'jobs:',
    '  build:',
    '    steps:',
    '      - run: bun run build',
    '      - run: |',
    '          bun run test',
    '      - run: >-',
    '          bun tools/release/cli.ts publish',
    '          --tag next',
    '      - name: run',
    '        with:',
    '          run: |',
    '            a',
    '            b',
    ''
  ].join('\n')
  // `with.run` is an action input, not shell.
  expect(multiLineRuns(workflow)).toEqual([])
})

test('reports each literal block of several commands at its line', () => {
  const action = [
    'runs:',
    '  using: composite',
    '  steps:',
    '    - shell: bash',
    '      run: |',
    '        git lfs install',
    '        git lfs pull',
    '',
    '    - shell: bash',
    '      run: "a\\nb"',
    ''
  ].join('\n')
  expect(multiLineRuns(action)).toEqual([
    { line: 5, lines: 2 },
    { line: 10, lines: 2 }
  ])
})

test('reports a step whose run is an alias of a literal block', () => {
  const workflow = [
    'x-script: &script |',
    '  a',
    '  b',
    'jobs:',
    '  build:',
    '    steps:',
    '      - run: *script',
    ''
  ].join('\n')
  expect(multiLineRuns(workflow)).toEqual([{ line: 7, lines: 2 }])
})
