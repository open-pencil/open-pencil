import { describe, expect, test } from 'bun:test'

import { mcpServerSetupPrompt, needsMCPInstall } from '@/app/automation/mcp/setup-prompt'

describe('MCP server setup prompt', () => {
  test('offers the prompt only for reasons an install fixes', () => {
    expect(needsMCPInstall({ code: 'not-installed' })).toBe(true)
    expect(needsMCPInstall({ code: 'outdated', detail: '0.15.1' })).toBe(true)
    expect(needsMCPInstall({ code: 'timeout' })).toBe(false)
  })

  test('asks the agent to install and verify the version that matches the app', () => {
    const prompt = mcpServerSetupPrompt({ code: 'outdated', detail: '0.15.1' })
    expect(prompt).toContain('`npm i -g @lawha/mcp@0.0.0-test`')
    expect(prompt).toContain('`lawha-mcp-http --version` prints 0.0.0-test')
    expect(prompt).toContain('found version 0.15.1 installed')
    expect(prompt).toContain('to keep its download small')
  })

  test('uses the command for the package manager that installed the server', () => {
    const prompt = mcpServerSetupPrompt(
      { code: 'outdated', detail: '0.15.1' },
      'bun add -g @lawha/mcp@0.0.0-test'
    )
    expect(prompt).toContain('`bun add -g @lawha/mcp@0.0.0-test`')
  })

  test('explains a missing command when nothing is installed', () => {
    expect(mcpServerSetupPrompt({ code: 'not-installed' })).toContain(
      'could not find the `lawha-mcp-http` command'
    )
  })
})
