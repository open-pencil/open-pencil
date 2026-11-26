import { JSX_REFERENCE } from '@open-pencil/design-jsx'

import { appPreferences, type PromptPreferences } from '@/app/settings/preferences/store'

import behavior from './system-prompt.md?raw'

/** OpenPencil's own instructions for the Design model, before the scene-authoring reference. */
export const BUILT_IN_DESIGN_PROMPT = behavior.trim()

/**
 * The Design model's instructions: OpenPencil's, with the person's from Settings after them or
 * in their place, then the scene-authoring reference, which every chat needs to write layers.
 * Chat and ACP share it; the reference is joined verbatim, since dedenting it would flatten its
 * indented code examples. Read when a chat starts, so a change applies to the next one.
 */
export function systemPrompt(
  design: PromptPreferences['design'] = appPreferences.value.prompts.design
): string {
  const own = design.text.trim()
  let instructions = [BUILT_IN_DESIGN_PROMPT]
  if (own && design.mode === 'replace') instructions = [own]
  else if (own) instructions = [BUILT_IN_DESIGN_PROMPT, `Instructions from the person:\n\n${own}`]
  return [...instructions, JSX_REFERENCE].join('\n\n')
}
