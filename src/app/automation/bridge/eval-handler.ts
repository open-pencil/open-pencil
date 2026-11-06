import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import { automationUndoLabel, executeWithDocumentUndo } from '@/app/automation/execution/editor'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

export function createAutomationEvalHandler(makeFigma: FigmaFactory) {
  return async function handleEval(target: AutomationTarget, args: unknown): Promise<unknown> {
    const code = (args as { code?: string }).code
    if (!code) throw new Error('Missing "code" in args')
    const figma = makeFigma(target.store, target.pageId)
    const run = compileScript(code)
    const result = await executeWithDocumentUndo(
      target.store,
      target.pageId,
      automationUndoLabel('eval'),
      () => run(figma)
    )
    target.store.requestRender()
    return { ok: true, result: result ?? null }
  }
}
