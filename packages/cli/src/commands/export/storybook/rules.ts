import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { matchesGlob } from 'node:path'

import * as v from 'valibot'

import { STORY_MODES, type StoryPlan, type StoryTarget } from '@open-pencil/dom-css'

/** The rules file a Storybook export reads from the working directory when it is there. */
export const RULES_FILE = 'openpencil.stories.json'

/**
 * A rule for the story files whose `<page>/<name>` path matches its glob: which stories they
 * have, and a title template with `{document}`, `{page}`, `{name}`, and `{path}`, the title
 * they would have.
 */
const StoryRule = v.object({
  match: v.pipe(v.string(), v.minLength(1)),
  stories: v.optional(v.picklist(STORY_MODES)),
  title: v.optional(v.pipe(v.string(), v.minLength(1)))
})

const StoryRules = v.object({ rules: v.array(StoryRule) })

export type StoryRules = v.InferOutput<typeof StoryRules>

/**
 * The rules in `path`, or in {@link RULES_FILE} when no path is given and the working
 * directory has one; null when there are none to read.
 */
export async function readStoryRules(path: string | undefined): Promise<StoryRules | null> {
  const file = path ?? RULES_FILE
  if (path === undefined && !existsSync(file)) return null
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), StoryRules),
    await readFile(file, 'utf8')
  )
  if (!parsed.success) throw new Error(`Invalid rules in ${file}: ${v.summarize(parsed.issues)}`)
  return parsed.output
}

const PLACEHOLDER = /\{(document|page|name|path)\}/g

function fillTitle(template: string, target: StoryTarget): string {
  const values: Record<string, string> = {
    document: target.document ?? '',
    page: target.page,
    name: target.name,
    path: target.title
  }
  return template.replace(PLACEHOLDER, (placeholder: string, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? placeholder) : placeholder
  )
}

/**
 * How each story file is written under `rules`: every rule whose glob matches the file's
 * original `<page>/<name>` path applies in order, so a later one overrides an earlier one, each
 * field on its own. Renaming never changes which rules match.
 */
export function storyPlan(rules: StoryRules): (target: StoryTarget) => StoryPlan {
  return (target) => {
    const path = `${target.page}/${target.name}`
    const plan: StoryPlan = {}
    for (const rule of rules.rules) {
      if (!matchesGlob(path, rule.match)) continue
      if (rule.stories) plan.stories = rule.stories
      if (rule.title) plan.title = fillTitle(rule.title, target)
    }
    return plan
  }
}
