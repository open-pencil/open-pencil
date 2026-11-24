import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { agentPairingSetup } from '@/app/cloud/pairing/setup'

const url = 'https://cloud.example.com/mcp'
const token = `opg_${'ab'.repeat(32)}`

describe('agent pairing setup', () => {
  test('gives the agent the endpoint and its token, in each form a person pastes', () => {
    const setup = agentPairingSetup(url, token)
    expect(setup.instructions).toContain(url)
    expect(setup.instructions).toContain(`Authorization: Bearer ${token}`)
    expect(setup.claudeCode).toBe(
      `claude mcp add --transport http openpencil ${url} --header "Authorization: Bearer ${token}"`
    )
    expect(
      v.parse(
        v.pipe(
          v.string(),
          v.parseJson(),
          v.object({
            mcpServers: v.object({
              openpencil: v.object({
                url: v.string(),
                headers: v.object({ Authorization: v.string() })
              })
            })
          })
        ),
        setup.config
      ).mcpServers.openpencil
    ).toEqual({ url, headers: { Authorization: `Bearer ${token}` } })
  })
})
