/**
 * W3C Design Tokens (DTCG 2025.10) as OpenPencil reads and writes them: one token file per
 * collection mode, a resolver document tying them together, and a file of composite style tokens.
 */

/** The `$type` values OpenPencil writes, plus `string`, which Figma reads and writes. */
export type DesignTokenType =
  | 'color'
  | 'dimension'
  | 'duration'
  | 'number'
  | 'fontFamily'
  | 'fontWeight'
  | 'string'
  | 'typography'
  | 'shadow'

/** A token as written: its value and the metadata DTCG and tools attach to it. */
export interface DesignToken {
  $type: DesignTokenType
  $value: unknown
  $description?: string
  $extensions?: Record<string, unknown>
}

/** A token document or group: tokens and nested groups by name, and `$` properties. */
export type DesignTokenGroup = { [name: string]: unknown }

/** A file of the export, by its path relative to the export's root. */
export interface DesignTokenFile {
  path: string
  content: DesignTokenGroup
}

/** Why a token, mode, or style was left out or changed; the names are as the document has them. */
export type DesignTokenIssue =
  | { kind: 'missing-value'; collection: string; mode: string; token: string }
  | { kind: 'missing-alias'; collection: string; mode: string; token: string }
  | { kind: 'duplicate-path'; collection: string; token: string }
  | { kind: 'unsupported-effect'; style: string }

/** An issue as one line of text, for the CLI and tool output. */
export function designTokenIssueMessage(issue: DesignTokenIssue): string {
  if (issue.kind === 'missing-value')
    return `${issue.collection} / ${issue.mode}: ${issue.token} has no value in this mode`
  if (issue.kind === 'missing-alias')
    return `${issue.collection} / ${issue.mode}: ${issue.token} points at a variable that is gone`
  if (issue.kind === 'duplicate-path')
    return `${issue.collection}: ${issue.token} has the same token path as another variable`
  return `${issue.style}: an effect style with no visible shadow has no token`
}

/** The key OpenPencil's own token data is kept under in `$extensions`. */
export const OPENPENCIL_EXTENSION = 'dev.openpencil'

/** The resolver document version DTCG 2025.10 requires. */
export const RESOLVER_VERSION = '2025-11-01'
