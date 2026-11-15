import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { asDouble } from '@open-pencil/test-support/doubles'

import type { AgentQuestion } from '@/app/ai/agents/acp/oneoff'
import type { AIModelRuntime } from '@/app/ai/models/runtime'
import {
  boundedImageScale,
  inspectRenderedDesign,
  type VisualInspectionDependencies
} from '@/app/ai/tools/vision/inspect'
import type { EditorStore } from '@/app/editor/session/create'

const claude = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
  'Claude agent'
)
describe('isolated visual inspection', () => {
  test('bounds renders and forwards only textual findings to the caller', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { width: 2560, height: 1600 })
    const rendered: Array<{ ids: string[]; scale: number }> = []
    const inspections: unknown[] = []
    const store = asDouble<EditorStore>({
      graph,
      state: { currentPageId: page.id, selectedIds: new Set([frame.id]) },
      renderExportImage: async (ids: string[], scale: number) => {
        rendered.push({ ids, scale })
        return new Uint8Array([1, 2, 3])
      }
    })
    const dependencies: VisualInspectionDependencies = {
      createRuntime: async () =>
        ({
          kind: 'direct',
          model: {} as LanguageModel,
          role: {
            requestedRole: 'vision',
            profile: {
              modelID: 'anthropic/claude-sonnet-4.6',
              customModelID: '',
              maxOutputTokens: 8000,
              thinkingLevel: 'low'
            },
            connection: { providerID: 'openrouter' }
          }
        }) as never,
      inspect: async (options) => {
        inspections.push(options)
        return { text: 'Align the button with the form edge.' } as never
      }
    }

    const result = await inspectRenderedDesign(store, {}, dependencies)

    expect(rendered).toEqual([{ ids: [frame.id], scale: 0.5 }])
    expect(result).toEqual({
      analysis: 'Align the button with the form edge.',
      inspectedNodeIds: [frame.id],
      image: { width: 1280, height: 800 }
    })
    const request = inspections[0] as {
      maxOutputTokens: number
      providerOptions?: unknown
      messages: Array<{ content: Array<{ type: string; data?: Uint8Array }> }>
    }
    expect(request.maxOutputTokens).toBe(1200)
    expect(request.providerOptions).toEqual({ openrouter: { reasoning: { effort: 'low' } } })
    expect(request.messages[0]?.content[1]?.type).toBe('file')
    expect(request.messages[0]?.content[1]?.data).toEqual(new Uint8Array([1, 2, 3]))
    expect(result).not.toHaveProperty('base64')
  })

  describe('when a coding agent holds Vision', () => {
    function inspectionStore() {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      const frame = graph.createNode('FRAME', page.id, { width: 640, height: 400 })
      const store = asDouble<EditorStore>({
        graph,
        state: { currentPageId: page.id, selectedIds: new Set([frame.id]) },
        renderExportImage: async () => new Uint8Array([1, 2, 3])
      })
      return { store, frame }
    }
    const agentRuntime = (kind: 'acp' | 'harness') => ({
      createRuntime: async () =>
        asDouble<AIModelRuntime>({
          kind,
          agent: claude,
          model: 'opus',
          role: { requestedRole: 'vision', profile: { maxOutputTokens: 8000 } }
        }),
      inspect: async () => {
        throw new Error('A direct model is not in play.')
      }
    })

    test('asks the agent about the render, on the model its profile names', async () => {
      const { store, frame } = inspectionStore()
      const asked: Array<{ id: string; question: AgentQuestion }> = []
      const result = await inspectRenderedDesign(
        store,
        { question: 'Is the button aligned?' },
        {
          ...agentRuntime('acp'),
          askAgent: async ({ id }, question) => {
            asked.push({ id, question })
            return 'It sits 2px low.'
          }
        }
      )
      expect(result).toMatchObject({ analysis: 'It sits 2px low.', inspectedNodeIds: [frame.id] })
      expect(asked).toHaveLength(1)
      expect(asked[0]?.id).toBe('claude-code')
      expect(asked[0]?.question).toMatchObject({
        text: 'Is the button aligned?',
        model: 'opus',
        images: [{ mediaType: 'image/png', data: new Uint8Array([1, 2, 3]) }]
      })
    })

    test('reports no Vision model for Pi, which takes no question outside a chat', async () => {
      const { store } = inspectionStore()
      expect(await inspectRenderedDesign(store, {}, agentRuntime('harness'))).toHaveProperty(
        'error'
      )
    })
  })

  test('never upscales bounded images', () => {
    expect(boundedImageScale(640, 400)).toBe(1)
    expect(boundedImageScale(2560, 1600)).toBe(0.5)
  })
})
