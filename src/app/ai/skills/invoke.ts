import { appSkillLibrary, type SkillLibrary } from './library'
import type { Skill } from './types'

/** How a message runs a skill by name, as in pi: `/skill:brand-review check the hero`. */
const SKILL_COMMAND = /^\/skill:([^\s]+)/

/** The skills the user can run by name: those switched on that allow it. */
export function runnableSkills(skills: readonly Skill[]): Skill[] {
  return skills.filter((skill) => skill.userInvocable)
}

/** The skill a message starts by running, read fresh; null when it names none that can run. */
export async function invokedSkill(
  text: string,
  library: SkillLibrary = appSkillLibrary
): Promise<Skill | null> {
  const name = SKILL_COMMAND.exec(text.trimStart())?.[1]
  if (!name) return null
  await library.refresh()
  return runnableSkills(library.enabled()).find((skill) => skill.name === name) ?? null
}
