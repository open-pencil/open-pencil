import { expect, test } from 'bun:test'

import { effectScope, nextTick, reactive, ref } from 'vue'

import { createModelProfileDraft } from '@/app/ai/models'
import { resetModelsDevCatalogForTests } from '@/app/ai/models/catalog'
import { useProfileModelSelection } from '@/app/ai/models/settings/profile-editor/selection'

const labels = ref({
  recommendedModels: 'Recommended',
  latestModels: 'Latest',
  allModels: 'All',
  latest: 'New',
  customModel: 'Custom'
})

test('selection immediately applies loaded catalog metadata and display name', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        openai: {
          models: {
            'catalog-model': {
              name: 'Catalog model',
              tool_call: true,
              attachment: true,
              modalities: { output: ['text'] },
              limit: { output: 32000 }
            }
          }
        }
      })
    )) as typeof fetch
  resetModelsDevCatalogForTests()
  const scope = effectScope()
  try {
    const draft = reactive(createModelProfileDraft())
    draft.providerID = 'openai'
    draft.modelID = ''
    draft.customModelID = ''
    draft.name = ''
    const selection = scope.run(() => useProfileModelSelection(draft, labels))
    if (!selection) throw new Error('Missing selection scope')
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
      if (selection.modelOptions.value.some((option) => option.value === 'catalog-model')) break
    }
    expect(selection.modelOptions.value.some((option) => option.value === 'catalog-model')).toBe(
      true
    )
    selection.updateModel('catalog-model')
    expect(draft.capabilities).toEqual(['tools', 'vision'])
    expect(draft.maxOutputTokens).toBe(32000)
    expect(draft.name).toBe('Catalog model')
    selection.updateProvider('deepseek')
    await nextTick()
    expect(selection.providerDef.value.id).toBe('deepseek')
    expect(draft.capabilities).toEqual(['tools'])
  } finally {
    scope.stop()
    globalThis.fetch = originalFetch
    resetModelsDevCatalogForTests()
  }
})
