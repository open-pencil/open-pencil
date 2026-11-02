import { describe, expect, test } from 'bun:test'

import { codingAgentSetupPrompt } from '@/app/ai/agents/setup/prompt'

describe('coding agent setup prompt', () => {
  test('tells Cursor to install from its guide and to start and sign in with cursor-agent', () => {
    const prompt = codingAgentSetupPrompt('cursor')
    expect(prompt).toContain(
      'If `cursor-agent` is not on my PATH, install Cursor from https://cursor.com/docs/cli/installation'
    )
    expect(prompt).toContain('which cursor-agent')
    expect(prompt).toContain('`cursor-agent login`')
  })

  test('gives an npm-installed agent its install command', () => {
    expect(codingAgentSetupPrompt('gemini-cli')).toContain(
      'install it: `npm i -g @google/gemini-cli`'
    )
  })
})
