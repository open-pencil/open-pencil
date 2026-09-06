import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { wrapEvalCode } from '@open-pencil/core/tools'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import { ensureGraphFonts } from '@/app/editor/fonts'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

export function createAutomationEvalHandler(makeFigma: FigmaFactory) {
  return async function handleEval(target: AutomationTarget, args: unknown): Promise<unknown> {
    const code = (args as { code?: string }).code
    if (!code) throw new Error('Missing "code" in args')
    const figma = makeFigma(target.store, target.pageId)
    const AsyncFunction = Object.getPrototypeOf(async function () {
      /* noop */
    }).constructor
    const fn = new AsyncFunction('figma', wrapEvalCode(code))
    const result = await target.store.runMutationWithLayout(
      () => fn(figma),
      target.pageId,
      async () => {
        const page = target.store.graph.getNode(target.pageId)
        if (page) await ensureGraphFonts(target.store.graph, page.childIds, target.store.renderer)
      }
    )
    target.store.requestRender()
    return { ok: true, result: result ?? null }
  }
}
