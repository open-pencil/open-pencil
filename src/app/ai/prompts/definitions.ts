import review from './templates/review.knap.md?raw'
import summary from './templates/summary.knap.md?raw'
import title from './templates/title.knap.md?raw'

/** The prompts a person can write their own of, as Knap templates. */
export const TEMPLATE_PROMPTS = ['review', 'title', 'summary'] as const
export type TemplatePrompt = (typeof TEMPLATE_PROMPTS)[number]

type TemplateValue = string | number | boolean

/** What a prompt's template is filled with, by name. */
export type PromptVariables = Record<string, TemplateValue>

export interface PromptDefinition {
  /** OpenPencil's own template, which a prompt of the person's replaces. */
  template: string
  /**
   * The variables the prompt is filled with, each with a value the settings preview shows. A
   * template that names another renders it empty, so the editor warns about it.
   */
  variables: PromptVariables
}

export const PROMPT_DEFINITIONS: Readonly<Record<TemplatePrompt, PromptDefinition>> = {
  review: {
    template: review,
    variables: {
      language: 'English',
      focus: 'spacing and hierarchy',
      sees_images: true,
      references: 1,
      edit: false
    }
  },
  title: {
    template: title,
    variables: {
      request: 'Make the pricing cards the same height',
      reply: 'I set all three cards to fill and aligned their buttons.'
    }
  },
  summary: { template: summary, variables: {} }
}
