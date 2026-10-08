/**
 * The stages the page can show. Kept free of imports so server-rendered sections can name a
 * stage without pulling the editor into the server bundle.
 */
export type StageKind =
  | 'hero'
  | 'figma'
  | 'design'
  | 'interactive'
  | 'tokens'
  | 'linting'
  | 'ai'
  | 'collab'
  | 'code'
  | 'script'
  | 'sdk'

/** Stages with one editor; the collaboration stage composes two of its own. */
export type SingleStageKind = Exclude<StageKind, 'collab'>
