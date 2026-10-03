/**
 * The stages the page can show. Kept free of imports so server-rendered sections can name a
 * stage without pulling the editor into the server bundle.
 */
export type StageKind =
  | 'hero'
  | 'figma'
  | 'design'
  | 'components'
  | 'ai'
  | 'code'
  | 'script'
  | 'sdk'
