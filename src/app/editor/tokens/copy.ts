import { uniq } from 'es-toolkit/array'

import type { TokenStylesheetFormat, TokenStylesheetIssue } from '@open-pencil/dom-css/export'

import type { EditorStore } from '@/app/editor/active-store'
import { copyPendingText } from '@/app/editor/clipboard/text'
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

class NothingToCopyError extends Error {
  constructor() {
    super('No variables could be written as CSS')
    this.name = 'NothingToCopyError'
  }
}

/** Copy the document's variables as a stylesheet, and name what had to be left out. */
export function createTokenCopy(store: EditorStore) {
  return async function copyTokens(format: TokenStylesheetFormat): Promise<void> {
    // The stylesheet generator and its CSS parser load only when someone copies tokens. The
    // clipboard write starts before either is ready, while the click still allows it.
    const stylesheet = import('@open-pencil/dom-css/export').then(({ tokenStylesheet }) =>
      tokenStylesheet(store.graph, { format })
    )
    const css = stylesheet.then((result) => {
      if (!result.css) throw new NothingToCopyError()
      return result.css
    })
    try {
      await copyPendingText(css, FORMAT_LABELS[format])
    } catch (error) {
      // An empty stylesheet rejects the pending text; the browser reports that as its own error.
      if ((await stylesheet).css) throw error
    }
    const { issues } = await stylesheet
    if (issues.length === 0) return
    const names = uniq(issues.map((issue) => issueSubject(store, issue)))
    toast.warning(notificationMessages.get().tokensLeftOut({ names: names.join(', ') }))
  }
}
