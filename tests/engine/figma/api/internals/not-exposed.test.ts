import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('internals not exposed', () => {
  test('node has no _id, _graph, _api properties', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect('_id' in frame).toBe(false)
    expect('_graph' in frame).toBe(false)
    expect('_api' in frame).toBe(false)
  })
})
