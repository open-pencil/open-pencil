import { valibotSchema } from '@ai-sdk/valibot'
import { generateText, tool } from 'ai'
import * as v from 'valibot'

import { computeContentBounds } from '@open-pencil/core/io'

import { buildReasoningProviderOptions } from '@/app/ai/chat/reasoning'
import { createAIModelRuntime } from '@/app/ai/models'
import type { VisionModelDependencies } from '@/app/ai/vision-runtime'
import type { EditorStore } from '@/app/editor/active-store'

const DEFAULT_VISION_MAX_EDGE = 1280
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

export function boundedImageScale(
  width: number,
  height: number,
  maxEdge = DEFAULT_VISION_MAX_EDGE
): number {
  const longestEdge = Math.max(width, height)
  if (longestEdge <= 0) return 0
  return Math.min(1, maxEdge / longestEdge)
}

export async function inspectRenderedDesign(
  store: EditorStore,
  request: VisualInspectionRequest,
  dependencies: VisualInspectionDependencies = {
    createRuntime: createAIModelRuntime,
    inspect: generateText
  }
): Promise<VisualInspectionResult | { error: string }> {
  const runtime = await dependencies.createRuntime('vision')
  if (runtime?.kind !== 'direct') {
    return { error: 'Configure a vision-capable model in Settings to inspect rendered designs.' }
  }

  const pageId = store.state.currentPageId
  let nodeIds = request.ids ?? []
  if (nodeIds.length === 0) nodeIds = [...store.state.selectedIds]
  if (nodeIds.length === 0) {
    nodeIds = store.graph.getChildren(pageId).map((node) => node.id)
  }
  const bounds = computeContentBounds(store.graph, nodeIds)
  if (!bounds) return { error: 'No visible design content to inspect.' }
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const scale = boundedImageScale(width, height, request.maxEdge)
  if (scale <= 0) return { error: 'No visible design content to inspect.' }

  const image = await store.renderExportImage(nodeIds, scale, 'PNG', pageId)
  if (!image) return { error: 'Could not render the design for visual inspection.' }

  const result = await dependencies.inspect({
    model: runtime.model,
    maxOutputTokens: Math.min(runtime.role.profile.maxOutputTokens, MAX_VISION_OUTPUT_TOKENS),
    providerOptions: buildReasoningProviderOptions(
      runtime.role.connection.providerID,
      runtime.role.profile.reasoningEffort ?? ''
    ),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              request.question?.trim() ||
              'Review this rendered design. Concisely identify visual hierarchy, alignment, spacing, clipping, contrast, and rendering problems. Return actionable findings only.'
          },
          { type: 'file', mediaType: 'image/png', data: image }
        ]
      }
    ]
  })

  return {
    analysis: result.text,
    inspectedNodeIds: nodeIds,
    image: {
      width: Math.ceil(width * scale),
      height: Math.ceil(height * scale)
    }
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
