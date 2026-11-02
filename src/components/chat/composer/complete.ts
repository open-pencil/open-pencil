import type { Completion, CompletionContext, CompletionSource } from '@codemirror/autocomplete'
import type { Component } from 'vue'
import IconBookOpen from '~icons/lucide/book-open'
import IconFile from '~icons/lucide/file'
import IconSquareSlash from '~icons/lucide/square-slash'

import type { CommandCandidate, ReferenceCandidate } from '@/app/ai/chat/references/candidates'
import { referenceLink, type ChatReferenceKind } from '@/app/ai/chat/references/link'
import { sceneNodeIcon } from '@/components/icons'

/** A completion with the glyph its row shows: a layer's kind, a page, a skill, a command. */
export interface ComposerCompletion extends Completion {
  icon: Component
}

export function isComposerCompletion(completion: Completion): completion is ComposerCompletion {
  return 'icon' in completion
}

export interface ComposerSections {
  node: string
  page: string
  skill: string
  command: string
}

/** A layer shows its own kind's glyph; these stand in for the rest. */
const KIND_ICONS: Record<ChatReferenceKind, Component> = {
  node: IconFile,
  page: IconFile,
  skill: IconBookOpen
}

const SECTION_RANK: Record<ChatReferenceKind, number> = { node: 0, page: 1, skill: 2 }

/** What may stand before an `@` that starts a reference: nothing, a space, or an opening bracket. */
const REFERENCE_START = /^[\s([]?$/

/** `@` anywhere offers layers, pages, and skills, replacing `@query` with a reference link. */
export function referenceCompletion(
  candidates: (query: string) => readonly ReferenceCandidate[],
  sections: () => ComposerSections
): CompletionSource {
  return (context: CompletionContext) => {
    const typed = context.matchBefore(/@[^\s@]*$/)
    if (!typed) return null
    if (!REFERENCE_START.test(context.state.sliceDoc(typed.from - 1, typed.from))) return null
    const names = sections()
    const query = typed.text.slice(1)
    // The candidates are matched and capped by the query already, so the list is shown as given
    // and asked for again as the query grows.
    return {
      from: typed.from,
      filter: false,
      options: candidates(query).map(({ reference, detail, node }): ComposerCompletion => ({
        icon: node ? sceneNodeIcon(node) : KIND_ICONS[reference.kind],
        label: reference.label || reference.id,
        detail: detail ?? undefined,
        section: { name: names[reference.kind], rank: SECTION_RANK[reference.kind] },
        apply: `${referenceLink(reference)} `
      }))
    }
  }
}

/** `/` at the start of a message offers commands; one replaces any command already there. */
export function commandCompletion(
  candidates: () => readonly CommandCandidate[],
  sections: () => ComposerSections
): CompletionSource {
  return (context: CompletionContext) => {
    const typed = context.matchBefore(/^\/\S*$/)
    if (typed?.from !== 0) return null
    const section = sections().command
    return {
      from: 0,
      validFor: /^\/\S*$/,
      options: candidates().map((command): ComposerCompletion => ({
        icon: command.kind === 'skill' ? IconBookOpen : IconSquareSlash,
        label: command.label,
        detail: command.detail,
        section,
        apply: command.insert
      }))
    }
  }
}
