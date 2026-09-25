import type { DocumentAssemblyOptions } from '@open-pencil/fig'

type Handler<K extends keyof DocumentAssemblyOptions> = NonNullable<DocumentAssemblyOptions[K]>

/** A saved record the reader could not apply and skipped instead of refusing the file. */
export type FigReaderDiagnostic =
  | { kind: 'property'; diagnostic: Parameters<Handler<'onUnresolvedProperty'>>[0] }
  | { kind: 'assignment'; diagnostic: Parameters<Handler<'onUnresolvedAssignment'>>[0] }
  | { kind: 'binding'; diagnostic: Parameters<Handler<'onUnresolvedBinding'>>[0] }
  | { kind: 'component'; diagnostic: Parameters<Handler<'onMissingComponent'>>[0] }

/**
 * Figma retains override and binding records that address nodes it later deleted, and
 * instances of deleted components, and the reader has no replacement to guess at. Opening
 * a file skips those records, keeps such instances childless, and reports both; a swap
 * whose replacement is missing is still a structural failure.
 */
export function readerSessionOptions(sink: FigReaderDiagnostic[]): DocumentAssemblyOptions {
  return {
    derivedBounds: true,
    onUnresolvedProperty: (diagnostic) => sink.push({ kind: 'property', diagnostic }),
    onUnresolvedAssignment: (diagnostic) => sink.push({ kind: 'assignment', diagnostic }),
    onUnresolvedBinding: (diagnostic) => sink.push({ kind: 'binding', diagnostic }),
    onMissingComponent: (diagnostic) => sink.push({ kind: 'component', diagnostic })
  }
}
