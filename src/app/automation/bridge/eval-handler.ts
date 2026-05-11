import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { wrapEvalCode } from '@open-pencil/core/tools'

import type { EditorStore } from '@/app/editor/active-store'

type FigmaFactory = () => FigmaAPI

export function createAutomationEvalHandler(makeFigma: FigmaFactory) {
  return async function handleEval(store: EditorStore, args: unknown): Promise<unknown> {
    const code = (args as { code?: string }).code
    if (!code) throw new Error('Missing "code" in args')
    const figma = makeFigma()
    const AsyncFunction = Object.getPrototypeOf(async function () {
      /* noop */
    }).constructor
    const fn = new AsyncFunction('figma', wrapEvalCode(code))
    const result = await fn(figma)
    store.requestRender()
    return { ok: true, result: result ?? null }
  }
}
