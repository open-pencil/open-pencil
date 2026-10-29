import { describe, expect, test } from 'bun:test'

import { MAX_PROMPT_LENGTH, parseHarnessRequest } from '../src/protocol'

describe('harness sidecar protocol', () => {
  test('parses a provider-neutral session configuration', () => {
    expect(
      parseHarnessRequest(
        JSON.stringify({
          id: 'request-1',
          method: 'session.create',
          params: {
            sessionId: 'session-1',
            configuration: {
              adapter: 'pi',
              sandbox: 'just-bash',
              model: 'provider/model',
              settings: { thinkingLevel: 'high' }
            }
          }
        })
      )
    ).toMatchObject({
      method: 'session.create',
      params: {
        configuration: { adapter: 'pi', sandbox: 'just-bash', model: 'provider/model' }
      }
    })
  })

  test('carries the skills a session may load, and rejects malformed ones', () => {
    const request = (skills: unknown) =>
      JSON.stringify({
        id: 'request-1',
        method: 'session.create',
        params: {
          sessionId: 'session-1',
          configuration: { adapter: 'pi', sandbox: 'just-bash', model: 'provider/model', skills }
        }
      })
    const grid = {
      name: 'grid',
      description: 'Lay out pages on an eight-point grid.',
      content: 'Snap frames to 8.',
      files: [{ path: 'references/spacing.md', content: '8' }]
    }
    expect(parseHarnessRequest(request([grid]))).toMatchObject({
      params: { configuration: { skills: [grid] } }
    })
    expect(() => parseHarnessRequest(request([{ name: 'grid' }]))).toThrow('skills[0]')
    expect(() => parseHarnessRequest(request([{ ...grid, files: [{ path: 'a.md' }] }]))).toThrow(
      'skills[0].files[0]'
    )
  })

  test('parses a turn request', () => {
    expect(
      parseHarnessRequest(
        JSON.stringify({
          id: 'request-1',
          method: 'session.turn',
          params: { sessionId: 'session-1', prompt: 'Inspect the document' }
        })
      )
    ).toEqual({
      id: 'request-1',
      method: 'session.turn',
      params: { sessionId: 'session-1', prompt: 'Inspect the document' }
    })
  })

  test('rejects unknown methods and oversized prompts', () => {
    expect(() =>
      parseHarnessRequest(JSON.stringify({ id: 'request-1', method: 'unknown' }))
    ).toThrow('Unknown harness method')
    expect(() =>
      parseHarnessRequest(
        JSON.stringify({
          id: 'request-1',
          method: 'session.turn',
          params: { sessionId: 'session-1', prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1) }
        })
      )
    ).toThrow('prompt exceeds')
  })
})
