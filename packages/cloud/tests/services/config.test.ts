import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

import { cloudDeployPath } from '#cloud-tests/helpers/paths'
import { ServicesConfigError, parseServicesTOML } from '#cloud/services'

const environment = {
  DATABASE_URL: 'postgresql://relay:secret@database/relay',
  OPENPENCIL_SERVICES_UPSTREAM_KEY: 'upstream-key'
}

const source = `schema_version = 1

[relay]
cloud_url = "https://cloud.example.com/some/path"
allowed_origins = ["https://app.example.com/"]

[upstream]
base_url = "https://openrouter.ai/api/v1/"

[catalog]
default_model = "anthropic/claude-sonnet-5-5"

[[catalog.models]]
id = "anthropic/claude-sonnet-5-5"
label = "Claude Sonnet 5.5"
credits_per_million_input_tokens = 3000
credits_per_million_output_tokens = 15000
context_tokens = 1000000
reasoning = true
vision = true
`

describe('Services server configuration', () => {
  test('reads the catalog, resolves secrets, and normalizes URLs', () => {
    const config = parseServicesTOML(source, environment)
    expect(config).toMatchObject({
      cloudURL: 'https://cloud.example.com',
      allowedOrigins: ['https://app.example.com'],
      maximumConcurrentRequests: 4,
      maximumRequestBytes: 16 * 1024 * 1024,
      databaseURL: environment.DATABASE_URL,
      upstreamURL: 'https://openrouter.ai/api/v1',
      upstreamKey: 'upstream-key'
    })
    expect(config.catalog).toEqual({
      defaultModelID: 'anthropic/claude-sonnet-5-5',
      models: [
        {
          id: 'anthropic/claude-sonnet-5-5',
          label: 'Claude Sonnet 5.5',
          creditsPerMillionInputTokens: 3000,
          creditsPerMillionOutputTokens: 15000,
          contextTokens: 1_000_000,
          capabilities: { reasoning: true, vision: true, tools: true }
        }
      ]
    })
  })

  test('the example file parses', async () => {
    const example = await readFile(cloudDeployPath('openpencil-services.example.toml'), 'utf8')
    expect(parseServicesTOML(example, environment).catalog.models).not.toBeEmpty()
  })

  test('requires the upstream key and a default model from the catalog', () => {
    expect(() => parseServicesTOML(source, { DATABASE_URL: environment.DATABASE_URL })).toThrow(
      'OPENPENCIL_SERVICES_UPSTREAM_KEY'
    )
    expect(() =>
      parseServicesTOML(
        source.replace('default_model = "anthropic', 'default_model = "openai'),
        environment
      )
    ).toThrow(ServicesConfigError)
    const duplicated = `${source}\n${source.slice(source.indexOf('[[catalog.models]]'))}`
    expect(() => parseServicesTOML(duplicated, environment)).toThrow('listed twice')
  })
})
