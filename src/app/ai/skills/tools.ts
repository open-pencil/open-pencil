import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import type { Skill } from './types'

/** Long enough for any reference the specification has in mind, short of flooding the context. */
const MAX_FILE_LENGTH = 64_000

export const SKILL_TOOL_NAMES: readonly string[] = ['load_skill', 'read_skill_file']

function unknownSkill(name: string, skills: readonly Skill[]): { error: string } {
  const names = skills.map((skill) => skill.name).join(', ')
  return { error: `No skill named "${name}". Available: ${names || 'none'}.` }
}

/** Tools that load a skill's instructions and files; `getSkills` is read at every call. */
export function createSkillTools(getSkills: () => readonly Skill[]) {
  function findSkill(name: string): Skill | undefined {
    return getSkills().find((skill) => skill.name === name)
  }

  return {
    load_skill: tool({
      description:
        'Load the instructions of a skill listed under Skills, by name. Call it before starting work that matches the skill.',
      inputSchema: valibotSchema(v.object({ name: v.string() })),
      execute: ({ name }) => {
        const skill = findSkill(name)
        if (!skill) return unknownSkill(name, getSkills())
        return { name: skill.name, instructions: skill.instructions, files: skill.files }
      }
    }),
    read_skill_file: tool({
      description:
        "Read a file from a skill's folder, by the skill's name and the file's path as load_skill listed it.",
      inputSchema: valibotSchema(v.object({ name: v.string(), path: v.string() })),
      execute: async ({ name, path }) => {
        const skill = findSkill(name)
        if (!skill) return unknownSkill(name, getSkills())
        // Only listed files: a path the model makes up must not reach the file system.
        if (!skill.files.includes(path)) {
          return {
            error: `"${path}" is not in skill "${name}". Its files: ${skill.files.join(', ') || 'none'}.`
          }
        }
        try {
          const text = await skill.readFile(path)
          if (text.length <= MAX_FILE_LENGTH) return { path, text }
          return { path, text: text.slice(0, MAX_FILE_LENGTH), truncated: true }
        } catch (error) {
          // The reader's message can name places on disk the model has no need to see.
          console.warn('Could not read a skill file', error)
          return { error: `Could not read "${path}".` }
        }
      }
    })
  }
}
