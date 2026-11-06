/** What a SKILL.md says about itself: its frontmatter and the instructions below it. */
export interface SkillDefinition {
  name: string
  description: string
  /** The Markdown body, which the model reads when it loads the skill. */
  instructions: string
  /** Listed for the model to load on its own; `disable-model-invocation` turns this off. */
  modelInvocable: boolean
  /** Offered for the user to run by name; `user-invocable: false` turns this off. */
  userInvocable: boolean
}

/**
 * Where skills come from: uploaded to OpenPencil, the folders around the open document, the
 * shared Agent Skills folder, Claude Code's.
 */
export type SkillSourceID = 'openpencil' | 'project' | 'agents' | 'claude'

/** Departures from the Agent Skills specification that do not stop a skill loading. */
export type SkillWarning =
  | 'plain-frontmatter'
  | 'name-from-folder'
  | 'long-name'
  | 'name-format'
  | 'name-mismatch'
  | 'long-description'

/** Why a SKILL.md could not be read as a skill. */
export type SkillParseError =
  | { code: 'no-frontmatter' }
  | { code: 'invalid-frontmatter'; detail: string }
  | { code: 'no-description' }
  | { code: 'no-name' }

export interface Skill extends SkillDefinition {
  source: SkillSourceID
  /** Where the skill was found, as the user sees it. */
  location: string
  /** The skills folder it was found in, for skills that need it trusted first. */
  skillsFolder?: string
  /** Files in the skill's folder other than SKILL.md, relative to the folder. */
  files: readonly string[]
  readFile: (path: string) => Promise<string>
  warnings: readonly SkillWarning[]
}

/** A folder with a SKILL.md that could not be read as a skill. */
export interface SkillProblem {
  source: SkillSourceID
  folder: string
  location: string
  skillsFolder?: string
  error: SkillParseError
}

export interface SkillScan {
  skills: Skill[]
  problems: SkillProblem[]
}
