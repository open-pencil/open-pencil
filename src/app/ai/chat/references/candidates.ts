import { compact } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { AgentCommand } from '@/app/ai/agents/acp/commands'
import { runnableSkills } from '@/app/ai/skills/invoke'
import type { Skill } from '@/app/ai/skills/types'

import type { ChatReference } from './link'

/** Matching layers past this many are left out of `@` completions; typing more narrows them. */
const MAX_LAYERS = 500

/**
 * Something `@` can insert, with what to show beside it: a layer's parent and, off the current
 * page, its page, so layers with the same name can be told apart.
 */
export interface ReferenceCandidate {
  reference: ChatReference
  detail: string | null
  /** A layer's node, for its icon. */
  node: SceneNode | null
}

/** A command `/` starts a message with: a skill to run, or one of an ACP agent's commands. */
export interface CommandCandidate {
  /** A skill of the user's, or a command the agent offers. */
  kind: 'skill' | 'agent'
  label: string
  detail: string
  /** The text the message starts with. */
  insert: string
}

/**
 * What `@query` offers: layers whose name contains the query, on the current page and then on
 * the other loaded pages, then the pages themselves and the skills. Pages that have not loaded
 * yet contribute only their name.
 */
export function referenceCandidates(
  graph: Pick<SceneGraph, 'getPages' | 'getChildren'>,
  currentPageId: string,
  skills: readonly Skill[],
  query = ''
): ReferenceCandidate[] {
  const needle = query.toLowerCase()
  const fits = (name: string) => name.toLowerCase().includes(needle)
  const pages = graph.getPages()
  const ordered = [
    ...pages.filter((page) => page.id === currentPageId),
    ...pages.filter((page) => page.id !== currentPageId)
  ]
  const layers: ReferenceCandidate[] = []
  const walk = (parentId: string, parentName: string | null, pageName: string | null) => {
    for (const child of graph.getChildren(parentId)) {
      if (layers.length >= MAX_LAYERS) return
      if (fits(child.name)) {
        layers.push({
          reference: { kind: 'node', id: child.id, label: child.name },
          detail: compact([parentName, pageName]).join(' · ') || null,
          node: child
        })
      }
      walk(child.id, child.name, pageName)
    }
  }
  for (const page of ordered) walk(page.id, null, page.id === currentPageId ? null : page.name)
  return [
    ...layers,
    ...pages
      .filter((page) => fits(page.name))
      .map((page) => ({
        reference: { kind: 'page' as const, id: page.id, label: page.name },
        detail: null,
        node: null
      })),
    ...skills
      .filter((skill) => fits(skill.name))
      .map((skill) => ({
        reference: { kind: 'skill' as const, id: skill.name, label: skill.name },
        detail: null,
        node: null
      }))
  ]
}

/** What `/` offers: an ACP agent's own commands, or else the skills the user can run. */
export function commandCandidates(
  agentCommands: readonly AgentCommand[] | null,
  skills: readonly Skill[]
): CommandCandidate[] {
  if (agentCommands) {
    return agentCommands.map((command) => ({
      kind: 'agent' as const,
      label: `/${command.name}`,
      detail: command.description,
      insert: `/${command.name} `
    }))
  }
  return runnableSkills(skills).map((skill) => ({
    kind: 'skill' as const,
    label: `/skill:${skill.name}`,
    detail: skill.description,
    insert: `/skill:${skill.name} `
  }))
}
