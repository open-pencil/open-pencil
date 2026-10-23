import { describe, expect, test } from 'bun:test'

import {
  findComponentMapping,
  implementationStoryURL,
  parseComponentMappings
} from '#dom-css/export/storybook/mapping/schema'

import { mappedFixture } from './fixtures'

describe('component mapping contract', () => {
  test.each(['not a URL', '', '/storybook', 'https://[invalid]/'])(
    'reports malformed base URL %j through mapping validation',
    (baseURL) => {
      const { config } = mappedFixture()
      expect(() =>
        parseComponentMappings(JSON.stringify({ ...config, storybook: { baseUrl: baseURL } }))
      ).toThrow('Invalid component mapping')
    }
  )

  test.each(['http://storybook.example.test/', 'https://storybook.example.test/components/'])(
    'preserves valid HTTP(S) base URL %j',
    (baseURL) => {
      const { config } = mappedFixture()
      expect(
        parseComponentMappings(JSON.stringify({ ...config, storybook: { baseUrl: baseURL } }))
          .storybook.baseUrl
      ).toBe(baseURL)
    }
  )

  test('resolves saved root and state IDs and builds explicit Storybook URLs', () => {
    const { config, mapping } = mappedFixture()
    expect(findComponentMapping(config, mapping.design.file, '12:10')).toBe(mapping)
    expect(findComponentMapping(config, mapping.design.file, '12:12')).toBe(mapping)
    expect(new URL(implementationStoryURL(config, mapping)).searchParams.get('path')).toBe(
      '/story/components-button--default'
    )
    expect(
      new URL(implementationStoryURL(config, mapping, mapping.states[0])).searchParams.get('path')
    ).toBe('/story/components-button--large')
    expect(() => findComponentMapping(config, mapping.design.file, '0:10')).toThrow('found 0')
  })

  test('rejects duplicate keys, saved identities and story targets globally', () => {
    const { config, mapping } = mappedFixture()
    expect(() =>
      parseComponentMappings(JSON.stringify({ ...config, components: [mapping, mapping] }))
    ).toThrow('Duplicate key')
    expect(() =>
      parseComponentMappings(
        JSON.stringify({ ...config, components: [mapping, { ...mapping, key: 'other' }] })
      )
    ).toThrow('Duplicate design identity')
    expect(() =>
      parseComponentMappings(
        JSON.stringify({
          ...config,
          components: [
            mapping,
            { ...mapping, key: 'other', design: { ...mapping.design, id: '12:100' } }
          ]
        })
      )
    ).toThrow('Duplicate story ID')
  })

  test('rejects unsafe paths, URLs, unsupported versions and prototype prop keys', () => {
    const { config, mapping } = mappedFixture()
    for (const file of [
      '../Button.fig',
      '/Button.fig',
      '~user/Button.fig',
      'C:\\Button.fig',
      'Button.pen'
    ])
      expect(() =>
        parseComponentMappings(
          JSON.stringify({
            ...config,
            components: [{ ...mapping, design: { ...mapping.design, file } }]
          })
        )
      ).toThrow('Invalid component mapping')
    for (const baseURL of [
      'data:text/html,unsafe',
      'ftp://example.test/',
      'https://user@example.test/',
      'https://user:pass@example.test/',
      'https://example.test/?path=x',
      'https://example.test/#story'
    ])
      expect(() =>
        parseComponentMappings(JSON.stringify({ ...config, storybook: { baseUrl: baseURL } }))
      ).toThrow('Invalid component mapping')
    expect(() => parseComponentMappings(JSON.stringify({ ...config, version: 2 }))).toThrow(
      'Invalid component mapping'
    )
    expect(() =>
      parseComponentMappings(
        JSON.stringify({
          ...config,
          components: [{ ...mapping, props: { '12:20': { prop: '__proto__' } } }]
        })
      )
    ).toThrow('Invalid component mapping')
  })
})
