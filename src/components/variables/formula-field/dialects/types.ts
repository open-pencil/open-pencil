import type { CompletionSource } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'

/** A variable the field can refer to, or a function it can call, as its completion list shows it. */
export interface ReferenceCompletion {
  label: string
  /** The collection, which groups the list as the variable picker does, or the functions' heading. */
  section: string
  /** The variable's current value, or what the function takes, shown at the row's end. */
  detail: string
  /**
   * The text inserted: a reference as the field spells it, such as `{space/md}` or
   * `var(--space-md)`, or a call's opening, such as `if(`.
   */
  insert: string
  /** A function is offered only where a bare name goes, never inside a `{` reference. */
  kind?: 'variable' | 'function'
}

/** A finished reference in the text, which the field shows as a pill. */
export interface ReferenceRange {
  source: string
  from: number
  to: number
}

/**
 * One syntax a value field edits: a formula over variables, or a CSS value. Each has its own
 * language, so completion reads the syntax tree, and its own reference spelling for pills.
 */
export interface ExpressionDialect {
  language: Extension
  complete: (references: () => readonly ReferenceCompletion[]) => CompletionSource
  references: (source: string) => ReferenceRange[]
}
