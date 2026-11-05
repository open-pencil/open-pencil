import { leadingCommand } from '@/app/ai/chat/references/command'

import { appSkillLibrary, type SkillLibrary } from './library'
import type { Skill } from './types'

/** The command that runs a skill by name, as in pi: `/skill:brand-review check the hero`. */
const SKILL_COMMAND = 'skill:'

export function skillCommand(name: string): string {
  return `${SKILL_COMMAND}${name}`
}

/** The skills the user can run by name: those switched on that allow it. */
export function runnableSkills(skills: readonly Skill[]): Skill[] {
  return skills.filter((skill) => skill.userInvocable)
}

/** The skill a message starts by running, read fresh; null when it names none that can run. */
export async function invokedSkill(
  text: string,
  library: SkillLibrary = appSkillLibrary
): Promise<Skill | null> {
  const command = leadingCommand(text)?.name
  if (!command?.startsWith(SKILL_COMMAND)) return null
  const name = command.slice(SKILL_COMMAND.length)
  await library.refresh()
  return runnableSkills(library.enabled()).find((skill) => skill.name === name) ?? null
}
