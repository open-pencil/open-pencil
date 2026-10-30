import { describe, expect, test } from 'bun:test'

import type { SessionModelState } from '@agentclientprotocol/sdk'

import { buildControls, resolveSplitModel } from '@/app/ai/agents/acp/catalog'

const models: SessionModelState = {
  currentModelId: 'gpt-5[medium]',
  availableModels: [
    { modelId: 'gpt-5[low]', name: 'gpt-5 low' },
    { modelId: 'gpt-5[medium]', name: 'gpt-5 medium' },
    { modelId: 'gpt-5[high]', name: 'gpt-5 high' },
    { modelId: 'mini[medium]', name: 'mini medium' }
  ]
}

describe('ACP session controls', () => {
  test('splits model[effort] ids into a model and a reasoning control', () => {
    const controls = buildControls({ models })
    expect(controls.map((c) => c.split)).toEqual(['base', 'effort'])
    expect(controls[0]?.options.map((o) => o.value)).toEqual(['gpt-5', 'mini'])
    expect(controls[1]?.current).toBe('medium')
  })

  test('uses a plain model control when ids carry no effort', () => {
    const controls = buildControls({
      models: {
        currentModelId: 'a',
        availableModels: [
          { modelId: 'a', name: 'A' },
          { modelId: 'b', name: 'B' }
        ]
      }
    })
    expect(controls).toHaveLength(1)
    expect(controls[0]).toMatchObject({ kind: 'model', current: 'a' })
  })

  test('adds a mode control from the session modes', () => {
    const controls = buildControls({
      modes: {
        currentModeId: 'ask',
        availableModes: [
          { id: 'ask', name: 'Ask' },
          { id: 'code', name: 'Code' }
        ]
      }
    })
    expect(controls[0]).toMatchObject({ kind: 'mode', current: 'ask' })
  })

  test('maps a split choice back to a full model id', () => {
    const [base, effort] = buildControls({ models })
    if (!base || !effort) throw new Error('expected split controls')
    expect(resolveSplitModel(models, effort, 'high')).toBe('gpt-5[high]')
    expect(resolveSplitModel(models, base, 'mini')).toBe('mini[medium]')
  })
})
