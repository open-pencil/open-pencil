import { expect, test } from 'bun:test'

import { compareURL, parseRemoteURL } from '@/app/integrations/git/pr'

test('a remote is read in both forms git writes it', () => {
  expect(parseRemoteURL('git@github.com:acme/site.git')).toEqual({
    host: 'github.com',
    owner: 'acme',
    repo: 'site'
  })
  expect(parseRemoteURL('https://github.com/acme/site.git')).toEqual({
    host: 'github.com',
    owner: 'acme',
    repo: 'site'
  })
  expect(parseRemoteURL('https://github.com/acme/site')).toEqual({
    host: 'github.com',
    owner: 'acme',
    repo: 'site'
  })
  expect(parseRemoteURL('ssh://git@gitlab.example.com/team/app.git')).toEqual({
    host: 'gitlab.example.com',
    owner: 'team',
    repo: 'app'
  })
})

test('a remote this app cannot read answers null', () => {
  expect(parseRemoteURL('')).toBeNull()
  expect(parseRemoteURL('/srv/git/site.git')).toBeNull()
  expect(parseRemoteURL('https://github.com/acme')).toBeNull()
})

test('the compare page names both branches', () => {
  const remote = { host: 'github.com', owner: 'acme', repo: 'site' }
  expect(compareURL(remote, 'main', 'dessn/pricing')).toBe(
    'https://github.com/acme/site/compare/main...dessn/pricing?expand=1'
  )
})
