import type { HarnessSkill } from '@open-pencil/harness'

import { appSkillLibrary, type SkillLibrary } from './library'
import type { Skill } from './types'

/**
 * Bytes a session may carry in skills, counted as the JSON the harness protocol sends, well
 * inside its 1 MB line, which also holds the instructions and MCP settings. Files past it are
 * left out; the instructions stay.
 */
const MAX_SKILLS_BYTES = 384 * 1024

const encoder = new TextEncoder()
/** The size of `text` as a JSON string, where escapes can take six bytes per character. */
const byteLength = (text: string) => encoder.encode(JSON.stringify(text)).byteLength

async function skillFiles(skill: Skill, budget: { left: number }): Promise<HarnessSkill['files']> {
  const files: NonNullable<HarnessSkill['files']> = []
  for (const path of skill.files) {
    const content = await skill.readFile(path).catch(() => null)
    const size = content === null ? 0 : byteLength(content)
    if (content === null || size > budget.left) continue
    budget.left -= size
    files.push({ path, content })
  }
  return files
}

/**
 * The enabled skills the model may load, as Pi's harness writes them into its own skills
 * folder; Pi lists them and loads them itself.
 */
export async function harnessSkills(
  library: SkillLibrary = appSkillLibrary
): Promise<HarnessSkill[]> {
  await library.refresh()
  const budget = { left: MAX_SKILLS_BYTES }
  const skills: HarnessSkill[] = []
  for (const skill of library.enabled()) {
    if (!skill.modelInvocable) continue
    const size = byteLength(skill.description) + byteLength(skill.instructions)
    if (size > budget.left) continue
    budget.left -= size
    skills.push({
      name: skill.name,
      description: skill.description,
      content: skill.instructions,
      files: await skillFiles(skill, budget)
    })
  }
  return skills
}
