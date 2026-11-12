import { describe, expect, spyOn, test } from 'bun:test'

import { cloudflareRayId, writeWorkersLogLine } from '#cloud/runtime/cloudflare/logging'

describe('cloudflareRayId', () => {
  test('names a request by its ray ID', () => {
    const headers = new Headers({ 'cf-ray': '8f1e2d3c4b5a6978-FRA', 'x-request-id': 'proxy-1' })
    expect(cloudflareRayId(headers)).toBe('8f1e2d3c4b5a6978-FRA')
  })

  test('keeps nothing that is not shaped like one', () => {
    expect(cloudflareRayId(new Headers({ 'cf-ray': 'not-a-ray' }))).toBeUndefined()
    expect(cloudflareRayId(new Headers({ 'x-request-id': 'proxy-1' }))).toBeUndefined()
  })
})

describe('writeWorkersLogLine', () => {
  test('logs the line as an object, whose keys Workers Logs indexes', () => {
    const logged = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      writeWorkersLogLine({ level: 'warn', message: 'Slow', requestId: 'ray' })
      expect(logged).toHaveBeenCalledWith({ level: 'warn', message: 'Slow', requestId: 'ray' })
    } finally {
      logged.mockRestore()
    }
  })
})
