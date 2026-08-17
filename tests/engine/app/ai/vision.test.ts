import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  boundedImageScale,
  inspectRenderedDesign,
  type VisualInspectionDependencies
} from '@/app/ai/tools/vision'
import type { EditorStore } from '@/app/editor/session/create'

describe('isolated visual inspection', () => {
  test('bounds renders and forwards only textual findings to the caller', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { width: 2560, height: 1600 })
    const rendered: Array<{ ids: string[]; scale: number }> = []
    const inspections: unknown[] = []
    const store = {
      graph,
      state: { currentPageId: page.id, selectedIds: new Set([frame.id]) },
      renderExportImage: async (ids: string[], scale: number) => {
        rendered.push({ ids, scale })
        return new Uint8Array([1, 2, 3])
      }
    } as EditorStore
    const dependencies: VisualInspectionDependencies = {
      createRuntime: async () =>
        ({
          kind: 'direct',
          model: {} as LanguageModel,
          role: {
            requestedRole: 'vision',
            profile: { maxOutputTokens: 8000, reasoningEffort: 'low' },
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

  test('never upscales bounded images', () => {
    expect(boundedImageScale(640, 400)).toBe(1)
    expect(boundedImageScale(2560, 1600)).toBe(0.5)
  })
})
