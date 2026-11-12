import { describe, expect, spyOn, test } from 'bun:test'

import { ref } from 'vue'

import { reportSubmissionError, type SubmissionMessages } from '@/app/ai/chat/submission/errors'
import { CloudAIUnavailableError } from '@/app/ai/models/runtime'

const messages: SubmissionMessages = {
  openSettings: 'Open settings',
  requestFailed: 'Request failed',
  visionUnavailable: 'Vision unavailable',
  cloudUnavailable: 'Cloud AI unavailable',
  runSetup: 'Run setup',
  agentSetup: {
    'companion-missing': '',
    'companion-outdated': '',
    'mcp-outdated': '',
    'pi-sign-in': '',
    'pi-model': ''
  }
}

describe('reportSubmissionError', () => {
  test('sends someone without Cloud AI to the model settings', () => {
    spyOn(console, 'error').mockImplementation(() => undefined)
    const reports: { message: string; label?: string }[] = []
    let opened = 0
    const options = {
      messages: ref(messages),
      reportError: (message: string, action?: { label: string; run: () => void }) => {
        reports.push({ message, label: action?.label })
        action?.run()
      },
      openModelSettings: () => opened++,
      openSetup: () => undefined
    }
    reportSubmissionError(options, new CloudAIUnavailableError())
    reportSubmissionError(options, new Error('other'))
    expect(reports).toEqual([
      { message: 'Cloud AI unavailable', label: 'Open settings' },
      { message: 'Request failed', label: undefined }
    ])
    expect(opened).toBe(1)
  })
})
