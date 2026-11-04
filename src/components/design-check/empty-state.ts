import type { DesignCheckMessages } from '@/app/editor/design-check/format'

import type { DesignCheckEmptyState, DesignCheckScope } from './types'

/** What the Lint panel lists, as far as choosing its empty state goes. */
export interface ListingState {
  scope: DesignCheckScope
  hasSelection: boolean
  /** Issues in scope before the severity filters, and the groups left after them. */
  issueCount: number
  groupCount: number
  filtersActive: boolean
  presetLabel: string
}

/** Why the panel lists nothing, or null when it lists something. */
export function emptyState(
  state: ListingState,
  messages: DesignCheckMessages
): DesignCheckEmptyState | null {
  if (state.scope === 'selection' && !state.hasSelection) {
    return {
      kind: 'no-selection',
      label: messages.noSelection,
      description: messages.noSelectionDescription
    }
  }
  if (state.groupCount > 0) return null
  if (state.filtersActive && state.issueCount > 0) {
    return { kind: 'filtered', label: messages.noFilteredIssues }
  }
  const labels: Record<DesignCheckScope, string> = {
    page: messages.emptyPage,
    selection: messages.emptySelection,
    document: messages.emptyDocument
  }
  return {
    kind: 'clean',
    label: labels[state.scope],
    description: messages.emptyDescription({ preset: state.presetLabel })
  }
}
