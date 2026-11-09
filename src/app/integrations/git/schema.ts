import * as v from 'valibot'

/** What `git_run` answers: the process exit code and both streams, decoded as text. */
export const gitRunReportSchema = v.object({
  code: v.number(),
  stdout: v.string(),
  stderr: v.string()
})
export type GitRunReport = v.InferOutput<typeof gitRunReportSchema>

/** What `git_version` answers, so the panel can explain a missing git before offering actions. */
export const gitAvailabilitySchema = v.object({
  available: v.boolean(),
  version: v.optional(v.nullable(v.string())),
  path: v.optional(v.nullable(v.string()))
})
export type GitAvailability = v.InferOutput<typeof gitAvailabilitySchema>

/** Which porcelain v2 record a status entry came from. */
export const gitFileKindSchema = v.picklist([
  'changed',
  'renamed',
  'unmerged',
  'untracked',
  'ignored'
])
export type GitFileKind = v.InferOutput<typeof gitFileKindSchema>

export const gitStatusEntrySchema = v.object({
  kind: gitFileKindSchema,
  /** The index-side status letter of the `XY` pair. */
  index: v.string(),
  /** The worktree-side status letter of the `XY` pair. */
  worktree: v.string(),
  path: v.string(),
  originalPath: v.optional(v.string())
})
export type GitStatusEntry = v.InferOutput<typeof gitStatusEntrySchema>

export const gitBranchStateSchema = v.object({
  /** The branch name, or null while HEAD is detached or the branch has no commits yet. */
  head: v.nullable(v.string()),
  oid: v.nullable(v.string()),
  upstream: v.nullable(v.string()),
  detached: v.boolean(),
  ahead: v.number(),
  behind: v.number()
})
export type GitBranchState = v.InferOutput<typeof gitBranchStateSchema>

export const gitStatusSchema = v.object({
  branch: gitBranchStateSchema,
  entries: v.array(gitStatusEntrySchema)
})
export type GitStatus = v.InferOutput<typeof gitStatusSchema>

/** One local branch as `branch --format` reports it. */
export const gitBranchSchema = v.object({
  name: v.string(),
  current: v.boolean()
})
export type GitBranch = v.InferOutput<typeof gitBranchSchema>

/** How one file stands against the last commit, as `status --porcelain` reports that path. */
export const gitFileStateSchema = v.picklist([
  'clean',
  'modified',
  'added',
  'untracked',
  'deleted',
  'renamed'
])
export type GitFileState = v.InferOutput<typeof gitFileStateSchema>

/** One commit that touched a file, as `log --format` reports it. */
export const gitCommitSummarySchema = v.object({
  hash: v.string(),
  author: v.string(),
  /** The author date, ISO 8601. */
  date: v.string(),
  subject: v.string()
})
export type GitCommitSummary = v.InferOutput<typeof gitCommitSummarySchema>
