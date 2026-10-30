import { escape } from 'es-toolkit/string'

import guidance from './catalog.md?raw'
import type { Skill } from './types'

/** The specification's description limit, applied to every listing so no skill crowds the rest. */
const MAX_LISTED_DESCRIPTION = 1024

function listedDescription(description: string): string {
  return description.length > MAX_LISTED_DESCRIPTION
    ? `${description.slice(0, MAX_LISTED_DESCRIPTION - 1)}…`
    : description
}

/**
 * The part of the model's instructions that lists skills by name and description, in the
 * `<available_skills>` form pi and Claude Code use; the instructions themselves load on demand.
 * Skills the user runs only by name are left out. Empty when nothing is listed.
 */
export function skillCatalog(skills: readonly Skill[]): string {
  const listed = skills.filter((skill) => skill.modelInvocable)
  if (listed.length === 0) return ''
  const entries = listed.map((skill) =>
    [
      '  <skill>',
      `    <name>${escape(skill.name)}</name>`,
      `    <description>${escape(listedDescription(skill.description))}</description>`,
      '  </skill>'
    ].join('\n')
  )
  return [guidance.trim(), '<available_skills>', ...entries, '</available_skills>'].join('\n')
}
