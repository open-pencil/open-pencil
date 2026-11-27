import { describe, expect, test } from 'bun:test'

import {
  decodeAutomationMessage,
  encodeAutomationMessage,
  type AutomationMessage
} from '@open-pencil/collab/automation'

const encoder = new TextEncoder()

describe('automation messages', () => {
  test('carry each kind of message through a room payload unchanged', () => {
    const messages: AutomationMessage[] = [
      { type: 'register' },
      { type: 'request', id: 'call-1', command: 'tool', args: { name: 'get_page_tree' } },
      { type: 'cancel', id: 'call-1' },
      { type: 'response', id: 'call-1', ok: true, result: { pages: 1 }, target: { pageId: '0:1' } },
      { type: 'response', id: 'call-2', ok: false, error: 'Node 9:9 not found' }
    ]
    for (const message of messages) {
      expect(decodeAutomationMessage(encodeAutomationMessage(message))).toEqual(message)
    }
  })

  test('read anything else as no message', () => {
    for (const text of [
      'not json',
      '[]',
      '{"type":"call","id":"x"}',
      '{"type":"request","id":""}'
    ]) {
      expect(decodeAutomationMessage(encoder.encode(text))).toBeNull()
    }
  })
})
