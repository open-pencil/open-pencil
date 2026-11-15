import { valibotSchema } from '@ai-sdk/valibot'
import { generateText, tool } from 'ai'
import * as v from 'valibot'

import { createAIModelRuntime } from '@/app/ai/models'
import { answersQuestions, askModel } from '@/app/ai/models/ask'
import { runPageId } from '@/app/ai/reply/run'
import type { VisionModelDependencies } from '@/app/ai/tools/vision/runtime'
import type { EditorStore } from '@/app/editor/active-store'

import { renderForModel } from './render'

const MAX_VISION_MAX_EDGE = 4096
const MAX_VISION_OUTPUT_TOKENS = 1200

export type VisualInspectionRequest = {
  ids?: string[]
  question?: string
  maxEdge?: number
}

export type VisualInspectionResult = {
  analysis: string
  inspectedNodeIds: string[]
  image: { width: number; height: number }
}

export type VisualInspectionDependencies = VisionModelDependencies

export async function inspectRenderedDesign(
  store: EditorStore,
  request: VisualInspectionRequest,
  dependencies: VisualInspectionDependencies = {
    createRuntime: createAIModelRuntime,
    inspect: generateText
  }
): Promise<VisualInspectionResult | { error: string }> {
  const runtime = await dependencies.createRuntime('vision')
  if (!runtime || !answersQuestions(runtime)) {
    return { error: 'Configure a vision-capable model in Settings to inspect rendered designs.' }
  }

  const pageId = runPageId(store)
  let nodeIds = request.ids ?? []
  // The user's selection belongs to the page on screen, which may not be the run's page.
  if (nodeIds.length === 0 && pageId === store.state.currentPageId)
    nodeIds = [...store.state.selectedIds]
  if (nodeIds.length === 0) {
    nodeIds = store.graph.getChildren(pageId).map((node) => node.id)
  }
  const render = await renderForModel(store, nodeIds, pageId, request.maxEdge)
  if (!render) return { error: 'No visible design content to inspect.' }

  const analysis = await askModel(
    runtime,
    {
      text:
        request.question?.trim() ||
        'Review this rendered design. Concisely identify visual hierarchy, alignment, spacing, clipping, contrast, and rendering problems. Return actionable findings only.',
      images: [{ mediaType: 'image/png', data: render.png }],
      maxOutputTokens: MAX_VISION_OUTPUT_TOKENS
    },
    { generate: dependencies.inspect, askAgent: dependencies.askAgent }
  )

  return {
    analysis,
    inspectedNodeIds: nodeIds,
    image: { width: render.width, height: render.height }
  }
}

export function createVisualInspectionTool(store: EditorStore) {
  return tool({
    description:
      'Render the current selection or specified nodes and ask the isolated Vision model to inspect their visual appearance. Returns text findings only; the image is not added to the Design chat history. Use only for explicit visual review or rendering diagnosis.',
    inputSchema: valibotSchema(
      v.object({
        ids: v.optional(v.array(v.string())),
        question: v.optional(v.string()),
        maxEdge: v.optional(v.pipe(v.number(), v.minValue(64), v.maxValue(MAX_VISION_MAX_EDGE)))
      })
    ),
    execute: (request) => inspectRenderedDesign(store, request)
  })
}
