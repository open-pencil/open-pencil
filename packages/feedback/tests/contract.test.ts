import { describe, expect, test } from 'bun:test'

import {
  describeBuildFields,
  describePingFields,
  describeReportFields,
  describeUsageEvents,
  reportSchema
} from '#feedback/contract'

describe('contract descriptions', () => {
  test('describe every usage event and property, with the values each can take', () => {
    const events = describeUsageEvents()

    expect(events.map(({ name }) => name)).toEqual([
      'app_opened',
      'document_opened',
      'document_exported',
      'ai_reply_finished',
      'usage_stats_enabled',
      'donate_clicked'
    ])
    for (const event of events) {
      expect(event.description).not.toBe('')
      for (const property of event.properties) {
        expect(property.description).not.toBe('')
        expect(property.values.length).toBeGreaterThan(0)
      }
    }
    expect(events[1].properties).toEqual([
      {
        name: 'format',
        description: 'The file format.',
        values: expect.arrayContaining(['fig', 'pen', 'html'])
      }
    ])
  })

  test('describe the ping as the build plus the usage stats answer', () => {
    expect(describePingFields().at(-1)).toEqual({
      name: 'usageStats',
      description: expect.stringContaining('declined'),
      values: ['unset', 'granted', 'denied']
    })
  })

  test('describe the build fields every ping and batch carries', () => {
    expect(describeBuildFields().map(({ name }) => name)).toEqual([
      'version',
      'platform',
      'arch',
      'app',
      'browser'
    ])
  })

  test('describe every report field besides the build', () => {
    const build = new Set(describeBuildFields().map(({ name }) => name))
    const fields = new Set(
      reportSchema.options
        .flatMap((option) => Object.keys(option.entries))
        .filter((name) => !build.has(name))
    )
    const described = describeReportFields()

    expect(new Set(described.map(({ name }) => name))).toEqual(fields)
    expect(described.every(({ description }) => description !== '')).toBe(true)
    expect(described.find(({ name }) => name === 'kind')?.values).toEqual(['error', 'problem'])
  })
})
