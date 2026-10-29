import { prepareGraphFonts, type DocumentFontStatus } from '@open-pencil/core/text'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { fail, printError } from '#cli/format'

export const FONT_POLICIES = new Set(['allow', 'strict', 'warn'])

/**
 * Reports the fonts a document could not load as `policy` asks: a warning, a failure before
 * anything is written (`strict`), or nothing (`allow`).
 */
export function reportFontStatus(status: DocumentFontStatus, policy: string): void {
  if (policy === 'allow' || status.faithful) return
  const names = status.issues.map((face) => `${face.family} ${face.style}`).join(', ')
  const message = `Font substitution: ${names}`
  if (policy === 'strict') {
    printError(message)
    process.exit(1)
  }
  console.error(fail(message))
}

export async function applyExportFontPolicy(
  graph: SceneGraph,
  roots: string[],
  format: string,
  policy: string
): Promise<void> {
  if (policy === 'allow' || !['PNG', 'JPG', 'WEBP', 'PDF'].includes(format)) return
  reportFontStatus(await prepareGraphFonts(graph, roots), policy)
}

export function exportFontRoots(
  nodeId: string | undefined,
  pageId: string,
  pageIds: string[],
  wholeDocument: boolean
): string[] {
  if (nodeId) return [nodeId]
  return wholeDocument ? pageIds : [pageId]
}
