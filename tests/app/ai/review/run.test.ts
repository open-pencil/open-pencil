import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { asDouble } from '@open-pencil/test-support/doubles'

import {
  askModel,
  ModelQuestionUnsupportedError,
  type ModelAnswer,
  type ModelQuestion
} from '@/app/ai/models/ask'
import type { AIModelRuntime } from '@/app/ai/models/runtime'
import {
  reviewChange,
  reviewDesign,
  ReviewEmptyError,
  ReviewImagesUnreadableError,
  ReviewModelMissingError,
  type ReviewDependencies
} from '@/app/ai/review/run'
import type { ToolChange } from '@/app/ai/tools/changes/types'
import type { EditorStore } from '@/app/editor/session/create'

const RENDER = new Uint8Array([1, 2, 3])
const REFERENCE = { mediaType: 'image/png', data: new Uint8Array([9]) }

/** A page with a card holding a button, and the card selected. */
function design({ select = true } = {}) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const card = graph.createNode('FRAME', page.id, { name: 'Card', width: 320, height: 200 })
  const button = graph.createNode('FRAME', card.id, { name: 'Button', width: 120, height: 40 })
  const rendered: string[][] = []
  const store = asDouble<EditorStore>({
    graph,
    state: { currentPageId: page.id, selectedIds: new Set(select ? [card.id] : []) },
    flushComponentSync: () => undefined,
    renderExportImage: async (ids: string[]) => {
      rendered.push(ids)
      return RENDER
    }
  })
  return { graph, page, card, button, store, rendered }
}

function runtime(kind: AIModelRuntime['kind'] = 'direct', capabilities = ['tools', 'vision']) {
  return asDouble<AIModelRuntime>({
    kind,
    model: asDouble<LanguageModel>({}),
    role: { profile: { capabilities, maxOutputTokens: 8000, thinkingLevel: 'default' } }
  })
}

/** A Review model that gives `answers` in turn, recording what it was asked. */
function reviewer(
  answers: Array<{ findings: string; zoomInto: string[] }>,
  held: AIModelRuntime | null = runtime()
) {
  const asked: ModelQuestion[] = []
  const dependencies: ReviewDependencies = {
    createRuntime: async () => held,
    ask: asDouble<ReviewDependencies['ask']>(
      async (_runtime: AIModelRuntime, question: ModelQuestion) => {
        asked.push(question)
        return expectDefined(answers.shift(), 'an answer for each question')
      }
    )
  }
  return { asked, dependencies }
}

describe('a design review', () => {
  test('shows the Review model the selection rendered, with its structure and lint', async () => {
    const { card, store, rendered } = design()
    const model = reviewer([{ findings: '- Pad the [Card](openpencil://node/x).', zoomInto: [] }])
    const review = await reviewDesign(store, { focus: 'spacing' }, model.dependencies)

    expect(review).toEqual({
      findings: '- Pad the [Card](openpencil://node/x).',
      nodeIds: [card.id],
      focus: 'spacing'
    })
    expect(rendered).toEqual([[card.id]])
    expect(model.asked).toHaveLength(1)
    expect(model.asked[0]?.images).toEqual([{ mediaType: 'image/png', data: RENDER }])
    expect(model.asked[0]?.text).toContain(card.id)
    expect(model.asked[0]?.text).toContain('spacing')
  })

  test('reviews the layers asked about, whatever is selected by the time it runs', async () => {
    const { card, button, store } = design()
    const model = reviewer([{ findings: '- Fine.', zoomInto: [] }])
    const review = await reviewDesign(store, { nodeIds: [button.id] }, model.dependencies)
    expect(review.nodeIds).toEqual([button.id])
    expect(review.nodeIds).not.toContain(card.id)
  })

  test('reviews the page’s layers when nothing is selected', async () => {
    const { card, store } = design({ select: false })
    const model = reviewer([{ findings: '- Fine.', zoomInto: [] }])
    expect((await reviewDesign(store, {}, model.dependencies)).nodeIds).toEqual([card.id])
  })

  test('shows the layers the model asks to see closer, then keeps its final findings', async () => {
    const { button, store, rendered } = design()
    const model = reviewer([
      { findings: '- The button may be clipped.', zoomInto: [button.id, 'missing:1'] },
      { findings: '- The button label is clipped by 2px.', zoomInto: [] }
    ])
    const review = await reviewDesign(store, { references: [REFERENCE] }, model.dependencies)

    expect(review.findings).toBe('- The button label is clipped by 2px.')
    expect(rendered.at(-1)).toEqual([button.id])
    expect(model.asked).toHaveLength(2)
    // The second request sees the design and the reference again, then the close-up.
    expect(model.asked[1]?.images).toEqual([
      { mediaType: 'image/png', data: RENDER },
      REFERENCE,
      { mediaType: 'image/png', data: RENDER }
    ])
    expect(model.asked[1]?.text).toContain('- The button may be clipped.')
  })

  test('compares against attached references, after the design', async () => {
    const { store } = design()
    const model = reviewer([{ findings: '- Borrow its spacing.', zoomInto: [] }])
    await reviewDesign(store, { references: [REFERENCE] }, model.dependencies)
    expect(model.asked[0]?.images).toEqual([{ mediaType: 'image/png', data: RENDER }, REFERENCE])
  })

  test('judges structure and lint alone for a model without image input', async () => {
    const { store, rendered } = design()
    const model = reviewer(
      [{ findings: '- Rename the layers.', zoomInto: [] }],
      runtime('direct', ['tools'])
    )
    await reviewDesign(store, {}, model.dependencies)
    expect(rendered).toEqual([])
    expect(model.asked[0]?.images).toEqual([])
  })

  test('takes an agent’s answer as its findings', async () => {
    const { store } = design()
    const claude = expectDefined(
      ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
      'Claude'
    )
    const agent = asDouble<AIModelRuntime>({
      kind: 'acp',
      agent: claude,
      model: 'opus',
      role: { profile: { capabilities: ['tools', 'vision'], maxOutputTokens: 8000 } }
    })
    const review = await reviewDesign(
      store,
      {},
      {
        createRuntime: async () => agent,
        ask: asDouble<ReviewDependencies['ask']>(
          (held: AIModelRuntime, question: ModelQuestion & { answer: ModelAnswer<unknown> }) =>
            askModel(held, question, { askAgent: async () => '- Align the title.' })
        )
      }
    )
    expect(review.findings).toBe('- Align the title.')
  })

  test.each([
    ['no model holds Review or Design', null, ReviewModelMissingError],
    ['Pi holds Review', runtime('harness'), ModelQuestionUnsupportedError]
  ] as const)('is refused when %s', async (_case, held, error) => {
    const { store } = design()
    await expect(reviewDesign(store, {}, reviewer([], held).dependencies)).rejects.toBeInstanceOf(
      error
    )
  })

  test('is refused with a reference for a model that cannot read images', async () => {
    const { store } = design()
    const model = reviewer([], runtime('direct', ['tools']))
    await expect(
      reviewDesign(store, { references: [REFERENCE] }, model.dependencies)
    ).rejects.toBeInstanceOf(ReviewImagesUnreadableError)
  })

  test('is refused on an empty page', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const store = asDouble<EditorStore>({
      graph,
      state: { currentPageId: page.id, selectedIds: new Set() },
      flushComponentSync: () => undefined
    })
    await expect(reviewDesign(store, {}, reviewer([]).dependencies)).rejects.toBeInstanceOf(
      ReviewEmptyError
    )
  })
})

describe('a review of one change', () => {
  const change: ToolChange = {
    toolCallId: 'call-1',
    pageId: '0:1',
    nodeIds: ['1:2'],
    jsx: { before: '<Frame name="Card" />', after: '<Frame name="Card" gap={24} />' },
    images: {
      before: new Blob([new Uint8Array([1])], { type: 'image/png' }),
      after: new Blob([new Uint8Array([2])], { type: 'image/png' }),
      highlight: null,
      width: 100,
      height: 50,
      changedRatio: 0.2
    }
  }

  test('shows the Review model the region before and after, with the JSX', async () => {
    const model = reviewer([{ findings: '- The gap helps.', zoomInto: [] }])
    const review = await reviewChange(change, {}, model.dependencies)

    expect(review).toEqual({ findings: '- The gap helps.', nodeIds: ['1:2'], change: 'call-1' })
    expect(model.asked[0]?.images).toEqual([
      { mediaType: 'image/png', data: new Uint8Array([1]) },
      { mediaType: 'image/png', data: new Uint8Array([2]) }
    ])
    expect(model.asked[0]?.text).toContain('gap={24}')
  })

  test('judges the JSX alone for a model without image input', async () => {
    const model = reviewer([{ findings: '- Fine.', zoomInto: [] }], runtime('direct', ['tools']))
    await reviewChange(change, {}, model.dependencies)
    expect(model.asked[0]?.images).toEqual([])
    expect(model.asked[0]?.text).toContain('<Frame name="Card" />')
  })

  test('judges the JSX alone for an edit kept without images', async () => {
    const model = reviewer([{ findings: '- Fine.', zoomInto: [] }])
    await reviewChange({ ...change, images: undefined }, {}, model.dependencies)
    expect(model.asked[0]?.images).toEqual([])
  })
})

describe('the language a review is written in', () => {
  test('falls back to the interface’s, for a review asked without words', async () => {
    const { store } = design()
    const model = reviewer([{ findings: '- Хорошо.', zoomInto: [] }])
    await reviewDesign(store, { language: 'Русский' }, model.dependencies)
    expect(model.asked[0]?.text).toContain('Русский')
  })

  test('falls back to the interface’s for a change review too', async () => {
    const model = reviewer([{ findings: '- Хорошо.', zoomInto: [] }])
    await reviewChange(
      { toolCallId: 'c', pageId: '0:1', nodeIds: [], jsx: { before: '', after: '' } },
      { language: '日本語' },
      model.dependencies
    )
    expect(model.asked[0]?.text).toContain('日本語')
  })
})
