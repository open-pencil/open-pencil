import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { wrapEvalCode } from '@open-pencil/core/tools'

import type { AutomationTarget } from '@/app/automation/bridge/target'

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
    const result = await fn(figma)
    target.store.requestRender()
    return { ok: true, result: result ?? null }
  }
}
