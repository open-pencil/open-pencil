import { expect, test } from 'bun:test'

import { parseFileHistory, parseFileState } from '@/app/integrations/git/file'

test('a path git has nothing to say about is clean', () => {
  expect(parseFileState('')).toBe('clean')
})

test('an untracked path is a file git has never seen', () => {
  expect(parseFileState('?? design/catalog.fig\0')).toBe('untracked')
})

test('a change in the worktree and a change in the index both read as modified', () => {
  expect(parseFileState(' M design/catalog.fig\0')).toBe('modified')
  expect(parseFileState('M  design/catalog.fig\0')).toBe('modified')
  expect(parseFileState('MM design/catalog.fig\0')).toBe('modified')
})

test('a staged new file reads as added, and a missing one as deleted', () => {
  expect(parseFileState('A  design/catalog.fig\0')).toBe('added')
  expect(parseFileState(' D design/catalog.fig\0')).toBe('deleted')
})

test('a rename takes two records and reads as renamed', () => {
  expect(parseFileState('R  design/new.fig\0design/old.fig\0')).toBe('renamed')
})

test('each history line becomes one commit', () => {
  const first = ['a'.repeat(40), 'Ada Lovelace', '2026-01-02T03:04:05+03:00', 'feat: catalog'].join(
    '\u001f'
  )
  const second = ['b'.repeat(40), 'Grace Hopper', '2025-12-31T23:00:00+03:00', 'fix: links'].join(
    '\u001f'
  )

  expect(parseFileHistory(`${first}\n${second}\n`)).toEqual([
    {
      hash: 'a'.repeat(40),
      author: 'Ada Lovelace',
      date: '2026-01-02T03:04:05+03:00',
      subject: 'feat: catalog'
    },
    {
      hash: 'b'.repeat(40),
      author: 'Grace Hopper',
      date: '2025-12-31T23:00:00+03:00',
      subject: 'fix: links'
    }
  ])
})

test('a commit with no subject still parses', () => {
  const line = ['c'.repeat(40), 'Ada Lovelace', '2026-01-02T03:04:05+03:00', ''].join('\u001f')

  expect(parseFileHistory(`${line}\n`)).toEqual([
    {
      hash: 'c'.repeat(40),
      author: 'Ada Lovelace',
      date: '2026-01-02T03:04:05+03:00',
      subject: ''
    }
  ])
})

test('a repository with no commits lists nothing', () => {
  expect(parseFileHistory('')).toEqual([])
})
