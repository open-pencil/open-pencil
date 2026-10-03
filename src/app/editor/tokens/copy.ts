import { uniq } from 'es-toolkit/array'

import type { TokenStylesheetFormat, TokenStylesheetIssue } from '@open-pencil/dom-css/export'

import type { EditorStore } from '@/app/editor/active-store'
import { createTextClipboard } from '@/app/editor/clipboard/text'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

const FORMAT_LABELS: Record<TokenStylesheetFormat, string> = {
  css: 'CSS',
  tailwind: 'Tailwind CSS'
}

/** The variable, or the collection and mode, an issue is about. */
function issueSubject(store: EditorStore, issue: TokenStylesheetIssue): string {
  const variable = issue.variableId ? store.graph.variables.get(issue.variableId) : undefined
  if (variable) return variable.name
  const collection = issue.collectionId
    ? store.graph.variableCollections.get(issue.collectionId)
    : undefined
  const mode = collection?.modes.find((candidate) => candidate.modeId === issue.modeId)
  return collection && mode ? `${collection.name}: ${mode.name}` : issue.message
}

/** Copy the document's variables as a stylesheet, and name what had to be left out. */
export function createTokenCopy(store: EditorStore) {
  const copyText = createTextClipboard()
  return async function copyTokens(format: TokenStylesheetFormat): Promise<void> {
    // The stylesheet generator and its CSS parser load only when someone copies tokens.
    const { tokenStylesheet } = await import('@open-pencil/dom-css/export')
    const { css, issues } = await tokenStylesheet(store.graph, { format })
    if (css) await copyText(css, FORMAT_LABELS[format])
    if (issues.length === 0) return
    const names = uniq(issues.map((issue) => issueSubject(store, issue)))
    toast.warning(notificationMessages.get().tokensLeftOut({ names: names.join(', ') }))
  }
}
