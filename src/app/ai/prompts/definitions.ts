import review from './templates/review.knap.md?raw'
import summary from './templates/summary.knap.md?raw'
import title from './templates/title.knap.md?raw'

/** The prompts a person can write their own of, as Knap templates. */
export const TEMPLATE_PROMPTS = ['review', 'title', 'summary'] as const
export type TemplatePrompt = (typeof TEMPLATE_PROMPTS)[number]

/**
 * Each template prompt: OpenPencil's own template, and
 * the variables it is filled with, each with a value the settings preview shows. The values give
 * each prompt's variables their types, so `renderPrompt` takes exactly these, and a template that
 * names another renders it empty, which the editor warns about.
 */
export const PROMPT_DEFINITIONS = {
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
} as const satisfies Record<
  TemplatePrompt,
  { template: string; variables: Record<string, unknown> }
>

/** Widens a sample's literal to its type: `'English'` to `string`, `true` to `boolean`. */
type Widened<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T

/** What the prompt `id` is filled with: each of its variables, of its sample's type. */
export type PromptVariables<Id extends TemplatePrompt> = {
  -readonly [Name in keyof (typeof PROMPT_DEFINITIONS)[Id]['variables']]: Widened<
    (typeof PROMPT_DEFINITIONS)[Id]['variables'][Name]
  >
}
