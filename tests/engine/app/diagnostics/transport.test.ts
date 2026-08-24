import { describe, expect, test } from 'bun:test'

import {
  diagnostics,
  recordACPTransportFailure,
  recordMCPConnectionFailure
} from '@/app/diagnostics'

describe('transport diagnostic events', () => {
  test('records safe ACP failures', async () => {
    await diagnostics.clear()
    recordACPTransportFailure({
      operation: 'message',
      errorName: 'NetworkError',
      errorCode: null,
      retryable: true
    })
    const [event] = await diagnostics.list()
    expect(event?.name).toBe('acp.transport.failed')
    expect(event?.attributes).toEqual({
      operation: 'message',
      errorName: 'NetworkError',
      errorCode: null,
      retryable: true
    })
  })

  test('rejects invalid MCP operations', async () => {
    await diagnostics.clear()
    recordMCPConnectionFailure({
      operation: 'invalid' as 'connect',
      errorName: 'Error',
      errorCode: null,
      retryable: null
    })
    expect(await diagnostics.list()).toHaveLength(0)
  })
})
