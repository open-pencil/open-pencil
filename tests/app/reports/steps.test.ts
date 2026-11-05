import { expect, test } from 'bun:test'

import type { DiagnosticEvent } from '@/app/diagnostics'
import { reportSteps } from '@/app/reports/steps'

function event(index: number, attributes: DiagnosticEvent['attributes'] = {}): DiagnosticEvent {
  return {
    id: `event-${index}`,
    timestamp: Date.UTC(2026, 10, 3, 9, 0, index),
    category: 'document',
    level: 'error',
    name: 'document.operation.failed',
    attributes
  }
}

test('steps run oldest first and keep only the most recent events', () => {
  const recentFirst = Array.from({ length: 80 }, (_, index) => event(80 - index))
  const steps = reportSteps(recentFirst)

  expect(steps).toHaveLength(50)
  expect(steps[0].timestamp).toBe(new Date(Date.UTC(2026, 10, 3, 9, 0, 31)).toISOString())
  expect(steps.at(-1)?.timestamp).toBe(new Date(Date.UTC(2026, 10, 3, 9, 0, 80)).toISOString())
})

test('steps keep attributes the service accepts and bound long text', () => {
  const [step] = reportSteps([
    event(1, { operation: 'open', 'not a key': 'dropped', stack: 'x'.repeat(5000), ok: false })
  ])

  expect(Object.keys(step.attributes)).toEqual(['operation', 'stack', 'ok'])
  expect(String(step.attributes.stack)).toHaveLength(4000)
})

test('events under names the service would refuse are left out', () => {
  expect(reportSteps([{ ...event(1), name: 'Legacy Event' }])).toEqual([])
})
