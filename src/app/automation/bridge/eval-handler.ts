import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import { automationUndoLabel, executeWithPageUndo } from '@/app/automation/execution/editor'
import { ensureGraphFonts } from '@/app/editor/fonts'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

export function createAutomationEvalHandler(makeFigma: FigmaFactory) {
  return async function handleEval(target: AutomationTarget, args: unknown): Promise<unknown> {
    const code = (args as { code?: string }).code
    if (!code) throw new Error('Missing "code" in args')
    const figma = makeFigma(target.store, target.pageId)
    const run = compileScript(code)
    const result = await executeWithPageUndo(
      target.store,
      target.pageId,
      automationUndoLabel('eval'),
      () =>
        target.store.runMutationWithLayout(
          () => run(figma),
          target.pageId,
          async () => {
            const page = target.store.graph.getNode(target.pageId)
            if (page)
              await ensureGraphFonts(target.store.graph, page.childIds, target.store.renderer)
          }
        )
    )
    target.store.requestRender()
    return { ok: true, result: result ?? null }
  }
}
