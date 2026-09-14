import { createToolLoopTransport } from '@/app/ai/chat/transports'

import { createRenderStreamModel, type RenderStreamScenario } from './model'

/** Test-only browser entrypoint. Uses the existing transport override, not production test hooks. */
export function installBrowserRenderStream(scenario: RenderStreamScenario) {
  const store = window.openPencil?.getStore?.()
  const setTransport = window.openPencil?.setChatTransport
  if (!store || !setTransport) throw new Error('Editor/chat bridge unavailable')
  const { model, ...controls } = createRenderStreamModel(scenario)
  setTransport(() =>
    createToolLoopTransport({
      store,
      model,
      providerID: 'openrouter',
      effectiveModelID: 'streaming-jsx',
      maxOutputTokens: 4096,
      reasoningEffort: ''
    })
  )
  return controls
}
