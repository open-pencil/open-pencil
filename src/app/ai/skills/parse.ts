import * as v from 'valibot'
import { parse as parseYAML } from 'yaml'

import type { SkillDefinition, SkillParseError, SkillWarning } from './types'

/** Limits from the Agent Skills specification (https://agentskills.io/specification). */
export const MAX_SKILL_NAME_LENGTH = 64
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

const frontmatterSchema = v.object({
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  'disable-model-invocation': v.optional(v.boolean()),
  'user-invocable': v.optional(v.boolean())
})

export type SkillParseResult =
  | { ok: true; skill: SkillDefinition; warnings: SkillWarning[] }
  | { ok: false; error: SkillParseError }

const PLAIN_LINE = /^([A-Za-z][\w-]*):[ \t]*(.*)$/

/**
 * Frontmatter that is not valid YAML read as one `key: value` per line, indented lines
 * continuing the value above. Descriptions with an unquoted ": " are the usual cause, and other
 * agents still load those skills.
 */
function readPlainFrontmatter(source: string): Record<string, string | boolean> {
  const fields: Record<string, string> = {}
  let key: string | null = null
  for (const line of source.split(/\r?\n/)) {
    const field = PLAIN_LINE.exec(line)
    if (field?.[1] !== undefined) {
      key = field[1]
      fields[key] = field[2]?.trim() ?? ''
    } else if (key !== null && /^\s+\S/.test(line)) {
      fields[key] = `${fields[key] ?? ''} ${line.trim()}`.trim()
    }
  }
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, plainValue(value)])
  )
}

function plainValue(value: string): string | boolean {
  if (value === 'true') return true
  if (value === 'false') return false
  return value.replace(/^(["'])(.*)\1$/, '$2')
}

function readFrontmatter(
  text: string
): { data: unknown; body: string; plain?: true } | { error: SkillParseError } {
  const match = FRONTMATTER.exec(text)
  if (!match) return { error: { code: 'no-frontmatter' } }
  const source = match[1] ?? ''
  const body = text.slice(match[0].length)
  try {
    return { data: parseYAML(source), body }
  } catch {
    return { data: readPlainFrontmatter(source), body, plain: true }
  }
}

/**
 * Reads a SKILL.md as pi and Claude Code do: a skill without a description cannot be offered,
 * so it fails; other departures from the specification are warnings and the skill still loads.
 * A SKILL.md that came without a folder, such as an upload, must name itself.
 */
export function parseSkill(text: string, folderName: string | null): SkillParseResult {
  const frontmatter = readFrontmatter(text)
  if ('error' in frontmatter) return { ok: false, error: frontmatter.error }
  const parsed = v.safeParse(frontmatterSchema, frontmatter.data ?? {})
  if (!parsed.success) {
    return { ok: false, error: { code: 'invalid-frontmatter', detail: v.summarize(parsed.issues) } }
  }
  const fields = parsed.output
  const description = fields.description?.trim() ?? ''
  if (!description) return { ok: false, error: { code: 'no-description' } }

  const warnings: SkillWarning[] = frontmatter.plain ? ['plain-frontmatter'] : []
  const name = fields.name?.trim() || folderName
  if (!name) return { ok: false, error: { code: 'no-name' } }
  if (!fields.name?.trim()) warnings.push('name-from-folder')
  if (name.length > MAX_SKILL_NAME_LENGTH) warnings.push('long-name')
  if (!NAME_PATTERN.test(name)) warnings.push('name-format')
  if (folderName !== null && name !== folderName) warnings.push('name-mismatch')
  if (description.length > MAX_SKILL_DESCRIPTION_LENGTH) warnings.push('long-description')

  return {
    ok: true,
    skill: {
      name,
      description,
      instructions: frontmatter.body.trim(),
      modelInvocable: fields['disable-model-invocation'] !== true,
      userInvocable: fields['user-invocable'] !== false
    },
    warnings
  }
}
