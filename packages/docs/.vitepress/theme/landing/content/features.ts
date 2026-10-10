/** The feature blocks, in page order. Each kind selects a stage in `stage/definitions.ts`. */
export const FEATURE_KINDS = [
  'figma',
  'design',
  'interactive',
  'tokens',
  'linting',
  'ai',
  'collab',
  'code',
  'script',
  'sdk'
] as const

export type FeatureKind = (typeof FEATURE_KINDS)[number]

/** Coding agents documented for the MCP server, the agent skill, or as built-in ACP agents. */
export const AGENTS = ['Claude Code', 'Cursor', 'Windsurf', 'Codex', 'Gemini CLI'] as const
