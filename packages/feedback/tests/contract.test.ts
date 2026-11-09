import { describe, expect, test } from 'bun:test'

import {
  describeBuildFields,
  describePingFields,
  describeReportFields,
  describeUsageEvents,
  pingSchema,
  pingStepOf,
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

  test('describe the ping as the build, the usage stats answer, and the step', () => {
    const fields = describePingFields()
    expect(fields.map(({ name }) => name)).toEqual(Object.keys(pingSchema.entries))
    expect(fields.slice(-3)).toEqual([
      {
        name: 'usageStats',
        description: expect.stringContaining('declined'),
        values: ['unset', 'granted', 'denied']
      },
      {
        name: 'pingDays',
        description: expect.stringContaining('never the exact number'),
        values: ['1', '2', '3-4', '5-8', '9-16', '17-32', '33-64', '65+']
      },
      {
        name: 'enteredStep',
        description: expect.stringContaining('into its step'),
        values: ['true', 'false']
      }
    ])
  })

  test('steps double, and only the first day of a step enters it', () => {
    const days = [1, 2, 3, 4, 5, 8, 9, 64, 65, 400]
    expect(days.map((day) => pingStepOf(day))).toEqual([
      { pingDays: '1', enteredStep: true },
      { pingDays: '2', enteredStep: true },
      { pingDays: '3-4', enteredStep: true },
      { pingDays: '3-4', enteredStep: false },
      { pingDays: '5-8', enteredStep: true },
      { pingDays: '5-8', enteredStep: false },
      { pingDays: '9-16', enteredStep: true },
      { pingDays: '33-64', enteredStep: false },
      { pingDays: '65+', enteredStep: true },
      { pingDays: '65+', enteredStep: false }
    ])
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
