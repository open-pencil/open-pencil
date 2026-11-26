import { describe, expect, test } from 'bun:test'

import { JSX_REFERENCE } from '@open-pencil/design-jsx'

import { BUILT_IN_DESIGN_PROMPT, systemPrompt } from '@/app/ai/chat/system-prompt'

describe('the Design model’s instructions', () => {
  test('are OpenPencil’s while the person wrote none', () => {
    const prompt = systemPrompt({ mode: 'replace', text: '   ' })
    expect(prompt.startsWith(BUILT_IN_DESIGN_PROMPT)).toBe(true)
  })

  test('add the person’s after OpenPencil’s', () => {
    const prompt = systemPrompt({ mode: 'add', text: 'Use 8px spacing.' })
    expect(prompt).toContain(BUILT_IN_DESIGN_PROMPT)
    expect(prompt.indexOf('Use 8px spacing.')).toBeGreaterThan(
      prompt.indexOf(BUILT_IN_DESIGN_PROMPT)
    )
  })

  test('are the person’s alone when they replace OpenPencil’s', () => {
    const prompt = systemPrompt({ mode: 'replace', text: 'Be terse.' })
    expect(prompt).not.toContain(BUILT_IN_DESIGN_PROMPT)
    expect(prompt.startsWith('Be terse.')).toBe(true)
  })

  test.each(['add', 'replace'] as const)('keep the authoring reference once when %s', (mode) => {
    expect(systemPrompt({ mode, text: 'Mine.' }).split(JSX_REFERENCE)).toHaveLength(2)
  })
})
