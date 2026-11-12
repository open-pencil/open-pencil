import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { openPencilArchitecturePlugin } from '../src/steiger-rules/index'

const rule = openPencilArchitecturePlugin.ruleDefinitions.find(
  (candidate) => candidate.name === 'open-pencil/prefer-domain-folders-over-filename-prefixes'
)

/** Entries ending in `/` are folders; the rest are files. */
function check(files: string[]) {
  return diagnose(files).length
}

function diagnose(files: string[]) {
  if (!rule) throw new Error('Missing file prefix rule')
  const root = '/repo'
  const folder = join(root, 'src/runtime')
  return rule
    .check({
      type: 'folder',
      path: root,
      children: [
        {
          type: 'folder',
          path: folder,
          children: files.map((file) =>
            file.endsWith('/')
              ? { type: 'folder' as const, path: join(folder, file.slice(0, -1)), children: [] }
              : { type: 'file' as const, path: join(folder, file) }
          )
        }
      ]
    })
    .diagnostics.map((diagnostic) => diagnostic.message)
}

test('asks for a folder when a file sits beside files named after it', () => {
  expect(check(['email.ts', 'email-runtime.ts'])).toBe(1)
  expect(check(['email.test.ts', 'email-runtime.test.ts'])).toBe(1)
  expect(check(['auth-failure.ts', 'auth-navigation.ts', 'auth-session.ts'])).toBe(1)
})

test('counts a plural file as the domain its singular siblings belong to', () => {
  expect(check(['handles.ts', 'handle-actions.ts'])).toBe(1)
  expect(check(['nodes.test.ts', 'node-preview.test.ts'])).toBe(1)
})

test('accepts names that only share a word', () => {
  expect(check(['sign-in.ts', 'sign-out.ts'])).toBe(0)
  expect(check(['email.ts', 'server.ts'])).toBe(0)
})

test('asks to move prefixed files into the folder named after their domain', () => {
  expect(check(['variants/', 'variant-set.ts'])).toBe(1)
  expect(check(['labels/', 'label-cache.test.ts'])).toBe(1)
  expect(check(['sdk/', 'sdk-sidebar.ts'])).toBe(1)
})

test('names the longest folder a compound prefix belongs in', () => {
  expect(diagnose(['cloud-portal/', 'cloud-portal-settings.ts'])).toEqual([
    'Move the cloud-portal-* files into the cloud-portal/ folder beside them.'
  ])
  expect(diagnose(['cloud/', 'cloud-portal/', 'cloud-portal-settings.ts'])).toEqual([
    'Move the cloud-portal-* files into the cloud-portal/ folder beside them.'
  ])
  expect(diagnose(['sign-in/', 'sign-in-form.ts', 'sign-out.ts'])).toEqual([
    'Move the sign-in-* files into the sign-in/ folder beside them.'
  ])
})

test('accepts folders that share a prefix, since each is a domain already', () => {
  expect(check(['cloud/', 'cloud-portal/'])).toBe(0)
  expect(check(['pixels.ts', 'pixel-grid/'])).toBe(0)
  expect(check(['sign-in/', 'sign-out.ts'])).toBe(0)
})
