import { describe, expect, test } from 'bun:test'

import { findPolicyViolations } from '../src/check'

describe('findPolicyViolations', () => {
  test('accepts neutral PR metadata and commits', () => {
    expect(
      findPolicyViolations({
        title: 'fix(editor): preserve selection',
        body: 'Tightens selection state updates.',
        commitMessages: ['fix(editor): preserve selection'],
        changedFiles: ['src/app/editor/selection.ts']
      })
    ).toEqual([])
  })

  test('rejects Claude attribution and generated branding', () => {
    const violations = findPolicyViolations({
      title: 'fix(editor): preserve selection',
      body: 'Generated with Claude Code.',
      commitMessages: [
        'fix(editor): preserve selection\n\nCo-authored-by: Claude <noreply@anthropic.com>'
      ],
      changedFiles: []
    })

    expect(violations.map((violation) => violation.location)).toEqual(['PR body', 'commit 1'])
  })

  test('rejects aggressive coding-harness product placement', () => {
    const violations = findPolicyViolations({
      title: 'feat: update export flow',
      body: 'Made with Cursor',
      commitMessages: [
        'feat: update export flow\n\nCo-authored-by: Cursor <cursoragent@cursor.com>',
        'fix: update tool prompt\n\n🤖 Generated with opencode',
        'docs: update notes\n\nCo-authored-by: GitHub Copilot <copilot@github.com>'
      ],
      changedFiles: []
    })

    expect(violations.map((violation) => violation.location)).toEqual([
      'PR body',
      'commit 1',
      'commit 2',
      'commit 3'
    ])
  })

  test('allows review-relevant model disclosure without coding-harness branding', () => {
    expect(
      findPolicyViolations({
        title: 'fix(editor): preserve selection',
        body: 'Model: claude-sonnet-4.5',
        commitMessages: ['fix(editor): preserve selection\n\nModel: gpt-5.1-codex'],
        changedFiles: []
      })
    ).toEqual([])
  })

  test('rejects committed Claude project configuration', () => {
    expect(
      findPolicyViolations({
        title: 'chore: add agent settings',
        body: '',
        commitMessages: ['chore: add agent settings'],
        changedFiles: ['.claude/settings.json']
      })
    ).toEqual([
      {
        location: '.claude/settings.json',
        message: 'Do not commit vendor-specific Claude Code project configuration.'
      }
    ])
  })

  test('allows committed tooling ignore references', () => {
    expect(
      findPolicyViolations({
        title: 'fix(steiger): ignore local claude config',
        body: '',
        commitMessages: ['fix(steiger): ignore local claude config'],
        changedFiles: ['steiger.config.ts']
      })
    ).toEqual([])
  })
})
