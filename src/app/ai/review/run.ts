import dedent from 'dedent'
import * as v from 'valibot'

import { ALL_TOOLS } from '@open-pencil/core/tools'

import {
  answersQuestions,
  askModel,
  ModelQuestionUnsupportedError,
  type ModelAnswer,
  type ModelQuestion
} from '@/app/ai/models/ask'
import { createAIModelRuntime, type AIModelRuntime } from '@/app/ai/models/runtime'
import type { ToolChange } from '@/app/ai/tools/changes/types'
import { renderForModel, type ModelRender } from '@/app/ai/tools/vision/render'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import type { EditorStore } from '@/app/editor/active-store'

import type { DesignReview } from './message'
import prompt from './prompt.md?raw'

/** The most layers the Review model may ask to see closer, and how large each close-up is. */
const MAX_ZOOMED_LAYERS = 3
const ZOOM_MAX_EDGE = 1024
/** How much of the layers' structure and lint findings a review carries. */
const MAX_CONTEXT_LENGTH = 40_000
const MAX_LINT_FINDINGS = 30

type ModelImage = NonNullable<ModelQuestion['images']>[number]

export interface ReviewRequest {
  /**
   * The page and layers to review, taken when the review was asked; the selection, or the
   * current page's layers, by default.
   */
  pageId?: string
  nodeIds?: string[]
  /** What the person asked the review to focus on. */
  focus?: string
  /** Images the person attached, which the design is compared against. */
  references?: readonly ModelImage[]
  /** The interface's language, which the review is written in when the request names none. */
  language?: string
  signal?: AbortSignal
}

/** What the review is written in: the request's language, else the interface's. */
function languageRule(language = 'English'): string {
  return `Write in the language of the person's request, or in ${language} when there is none.`
}

export interface ReviewDependencies {
  createRuntime: typeof createAIModelRuntime
  ask: typeof askModel
}

/** No model can review: Review is unassigned and so is Design. */
export class ReviewModelMissingError extends Error {
  constructor() {
    super('Assign a model to Review or Design in Settings to review designs.')
    this.name = 'ReviewModelMissingError'
  }
}

/** The person attached a reference, and the Review model cannot read images. */
export class ReviewImagesUnreadableError extends Error {
  constructor() {
    super('The Review model cannot read images, so it cannot compare against a reference.')
    this.name = 'ReviewImagesUnreadableError'
  }
}

/** There is nothing on the page to review. */
export class ReviewEmptyError extends Error {
  constructor() {
    super('There is nothing on this page to review.')
    this.name = 'ReviewEmptyError'
  }
}

/**
 * What the Review model answers: its findings, and the layers it wants to see closer before it
 * settles them. An agent answers over ACP in text alone, which is its findings.
 */
const REVIEW_ANSWER: ModelAnswer<{ findings: string; zoomInto: string[] }> = {
  schema: v.object({
    findings: v.pipe(
      v.string(),
      v.description('The findings as Markdown bullets, with links to the layers they are about')
    ),
    zoomInto: v.pipe(
      v.array(v.string()),
      v.description(
        `IDs of up to ${MAX_ZOOMED_LAYERS} layers to see closer, when the image is too small to judge their details; empty when it is enough`
      )
    )
  }),
  name: 'design_review',
  fromText: (text) => ({ findings: text, zoomInto: [] })
}

const DEFAULT_DEPENDENCIES: ReviewDependencies = {
  createRuntime: createAIModelRuntime,
  ask: askModel
}

/** The review's layers: the selection, or the current page's own layers when nothing is selected. */
export function reviewTarget(
  store: EditorStore
): Required<Pick<ReviewRequest, 'pageId' | 'nodeIds'>> {
  const pageId = store.state.currentPageId
  const selected = [...store.state.selectedIds]
  const nodeIds =
    selected.length > 0 ? selected : store.graph.getChildren(pageId).map((node) => node.id)
  return { pageId, nodeIds }
}

function toolNamed(name: string) {
  const def = ALL_TOOLS.find((tool) => tool.name === name)
  if (!def) throw new Error(`OpenPencil has no ${name} tool`)
  return def
}

/** The layers' structure and lint findings, as the Design agent's own tools report them. */
async function layerContext(store: EditorStore, nodeIds: string[], pageId: string) {
  const figma = makeFigmaFromStore(store, pageId)
  const structure = await toolNamed('describe').execute(figma, { ids: nodeIds })
  const lint = await toolNamed('lint').execute(figma, { ids: nodeIds, limit: MAX_LINT_FINDINGS })
  const text = dedent`
    Structure:
    ${JSON.stringify(structure)}

    Lint findings:
    ${JSON.stringify(lint)}
  `
  return text.length > MAX_CONTEXT_LENGTH ? `${text.slice(0, MAX_CONTEXT_LENGTH)}…` : text
}

function png(render: ModelRender): ModelImage {
  return { mediaType: 'image/png', data: render.png }
}

function question(
  context: string,
  { focus, references = [], language }: ReviewRequest,
  sees: boolean
): string {
  const parts = [prompt.trim(), languageRule(language)]
  if (!sees) parts.push('There is no image: judge from the structure and lint findings alone.')
  else if (references.length > 0)
    parts.push(
      `The first image is the design; the ${references.length === 1 ? 'next is a reference' : `next ${references.length} are references`} to compare it against.`
    )
  if (focus) parts.push(`The person asked the review to focus on: ${focus}`)
  parts.push(context)
  return parts.join('\n\n')
}

/** Close-ups of the layers the model asked to see, which are on the page and show something. */
async function closeUps(store: EditorStore, ids: readonly string[], pageId: string) {
  const shown: { id: string; render: ModelRender }[] = []
  for (const id of ids.slice(0, MAX_ZOOMED_LAYERS)) {
    if (store.graph.closest(id, (node) => node.type === 'CANVAS')?.id !== pageId) continue
    const render = await renderForModel(store, [id], pageId, ZOOM_MAX_EDGE)
    if (render) shown.push({ id, render })
  }
  return shown
}

function canSee(runtime: AIModelRuntime): boolean {
  return runtime.role.profile.capabilities.includes('vision')
}

/** The model that holds Review, which can be asked a question. */
async function reviewModel(createRuntime: typeof createAIModelRuntime): Promise<AIModelRuntime> {
  const runtime = await createRuntime('review')
  if (!runtime) throw new ReviewModelMissingError()
  if (!answersQuestions(runtime)) throw new ModelQuestionUnsupportedError()
  return runtime
}

async function blobImage(blob: Blob): Promise<ModelImage> {
  return { mediaType: blob.type || 'image/png', data: new Uint8Array(await blob.arrayBuffer()) }
}

/**
 * A design review of the selection, or the current page when nothing is selected, written by the
 * model assigned to Review, which "Same as Design" makes the Design model. It sees the layers
 * rendered when its profile reads images, with their structure and lint findings, and may ask
 * once to see some of them closer.
 */
export async function reviewDesign(
  store: EditorStore,
  request: ReviewRequest,
  { createRuntime, ask }: ReviewDependencies = DEFAULT_DEPENDENCIES
): Promise<DesignReview> {
  // Taken before anything awaits, so a selection changed meanwhile is not reviewed instead.
  const asked = reviewTarget(store)
  const pageId = request.pageId ?? asked.pageId
  const nodeIds = request.nodeIds ?? asked.nodeIds
  const runtime = await reviewModel(createRuntime)
  const sees = canSee(runtime)
  const references = request.references ?? []
  if (!sees && references.length > 0) throw new ReviewImagesUnreadableError()
  if (nodeIds.length === 0) throw new ReviewEmptyError()
  const render = sees ? await renderForModel(store, nodeIds, pageId) : null
  if (sees && !render) throw new ReviewEmptyError()

  const context = await layerContext(store, nodeIds, pageId)
  const shown = render ? [png(render), ...references] : []
  const first = await ask(runtime, {
    text: question(context, request, sees),
    images: shown,
    signal: request.signal,
    answer: REVIEW_ANSWER
  })
  const zoomed = sees ? await closeUps(store, first.zoomInto, pageId) : []
  if (zoomed.length === 0) return { findings: first.findings, nodeIds, focus: request.focus }

  // A new request: it sees the design and references again, with the close-ups after them.
  const second = await ask(runtime, {
    text: dedent`
      ${question(context, request, sees)}

      Your first review:
      ${first.findings}

      The last ${zoomed.length === 1 ? 'image is a close-up' : `${zoomed.length} images are close-ups`} of the layers you asked to see, in this order: ${zoomed.map(({ id }) => id).join(', ')}. Write the final review, correcting or adding findings from what they show. Ask for no more close-ups.
    `,
    images: [...shown, ...zoomed.map(({ render: closeUp }) => png(closeUp))],
    signal: request.signal,
    answer: REVIEW_ANSWER
  })
  return { findings: second.findings, nodeIds, focus: request.focus }
}

/** Marks a snapshot cut to fit, so the model knows it does not see all of it. */
const CUT_MARK = '\n… (cut to fit)'

/**
 * The edit's JSX before and after, each within half of `budget` characters, so a long snapshot
 * never pushes the other out and both can still be compared.
 */
export function snapshotsWithin(
  { before, after }: ToolChange['jsx'],
  budget: number
): ToolChange['jsx'] {
  const half = Math.floor(budget / 2)
  const clip = (text: string) =>
    text.length > half ? `${text.slice(0, Math.max(0, half - CUT_MARK.length))}${CUT_MARK}` : text
  return { before: clip(before), after: clip(after) }
}

/**
 * A review of one AI edit: whether it improved the design, from the images of the changed region
 * before and after it, which the chat keeps, and the JSX of its layers before and after. A model
 * without image input, or an edit kept without images, is judged on the JSX alone. The layers
 * may have changed since, so there are no close-ups.
 */
export async function reviewChange(
  change: ToolChange,
  { signal, language }: Pick<ReviewRequest, 'signal' | 'language'> = {},
  { createRuntime, ask }: ReviewDependencies = DEFAULT_DEPENDENCIES
): Promise<DesignReview> {
  const runtime = await reviewModel(createRuntime)
  const { before, after } = change.images ?? {}
  const images =
    canSee(runtime) && before && after ? [await blobImage(before), await blobImage(after)] : []
  const jsx = snapshotsWithin(change.jsx, MAX_CONTEXT_LENGTH)
  const text = [
    prompt.trim(),
    languageRule(language),
    'Review one edit to the design: did it improve the design? Say what got better, what got worse, and what was lost, each with the change that would fix it. Ask for no close-ups.',
    images.length > 0
      ? 'The first image is the changed region before the edit, the second after it.'
      : 'There is no image: judge from the JSX alone.',
    // Joined rather than dedented, which would flatten the snapshots' own indentation.
    `JSX before:\n${jsx.before}`,
    `JSX after:\n${jsx.after}`
  ].join('\n\n')
  const answer = await ask(runtime, { text, images, signal, answer: REVIEW_ANSWER })
  return { findings: answer.findings, nodeIds: change.nodeIds, change: change.toolCallId }
}
