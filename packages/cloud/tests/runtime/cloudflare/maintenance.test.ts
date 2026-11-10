import { describe, expect, test } from 'bun:test'

import {
  inMaintenance,
  MAINTENANCE_VARIABLE,
  maintenanceResponse
} from '#cloud/runtime/cloudflare/maintenance'

describe('maintenance', () => {
  test('is on only when the variable says so', () => {
    expect(inMaintenance({ [MAINTENANCE_VARIABLE]: 'on' })).toBe(true)
    expect(inMaintenance({ [MAINTENANCE_VARIABLE]: 'off' })).toBe(false)
    expect(inMaintenance({})).toBe(false)
  })

  test('answers 503 with a retry hint, named by its ray ID', async () => {
    const response = maintenanceResponse(
      new Request('https://cloud.example/api', { headers: { 'cf-ray': '8f1e2d3c4b5a6978-FRA' } })
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('300')
    expect(response.headers.get('X-Request-Id')).toBe('8f1e2d3c4b5a6978-FRA')
    expect(await response.text()).toContain('maintenance')
  })
})
