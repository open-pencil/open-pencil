import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { openPencilArchitecturePlugin } from '../src/steiger-rules/index'

const rule = openPencilArchitecturePlugin.ruleDefinitions.find(
  (candidate) => candidate.name === 'open-pencil/prefer-domain-folders-over-filename-prefixes'
)

function check(files: string[]) {
  if (!rule) throw new Error('Missing file prefix rule')
  const root = '/repo'
  const folder = join(root, 'src/runtime')
  return rule.check({
    type: 'folder',
    path: root,
    children: [
      {
        type: 'folder',
        path: folder,
        children: files.map((file) => ({ type: 'file' as const, path: join(folder, file) }))
      }
    ]
  }).diagnostics.length
}

test('asks for a folder when a file sits beside files named after it', () => {
  expect(check(['email.ts', 'email-runtime.ts'])).toBe(1)
  expect(check(['email.test.ts', 'email-runtime.test.ts'])).toBe(1)
  expect(check(['auth-failure.ts', 'auth-navigation.ts', 'auth-session.ts'])).toBe(1)
})

test('accepts names that only share a word', () => {
  expect(check(['sign-in.ts', 'sign-out.ts'])).toBe(0)
  expect(check(['email.ts', 'server.ts'])).toBe(0)
})
