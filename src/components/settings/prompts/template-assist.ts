import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { hoverTooltip, keymap, type Tooltip } from '@codemirror/view'

import {
  loadPromptFilters,
  templatePlace,
  TEMPLATE_TAGS,
  type TemplatePlace
} from '@/app/ai/prompts/engine'
import { appMenuShortcuts } from '@/app/shell/menu/shortcut'
import { withoutMenuKeys } from '@/components/code-editor/keys'

/** A variable a prompt offers: what it holds, and the sample value its preview is filled with. */
export interface TemplateVariable {
  description: string
  sample: unknown
}

type Variables = () => Readonly<Record<string, TemplateVariable>>

/** A variable's description, type, and sample, as a template would write the sample. */
function describe(variables: Variables, name: string) {
  if (!Object.hasOwn(variables(), name)) return null
  const { description, sample } = variables()[name]
  return { description, type: typeof sample, sample: JSON.stringify(sample) }
}

async function completions(place: TemplatePlace, variables: Variables): Promise<Completion[]> {
  if (place.kind === 'tag') return TEMPLATE_TAGS.map((label) => ({ label, type: 'keyword' }))
  if (place.kind === 'filter') {
    const filters = await loadPromptFilters()
    return filters.map(({ name, example }) => ({ label: name, type: 'function', detail: example }))
  }
  const names = new Set([...Object.keys(variables()), ...place.defined])
  return [...names].map((name) => {
    const known = describe(variables, name)
    return known
      ? {
          label: name,
          type: 'variable',
          detail: known.type,
          info: () => tooltipContent(known.sample, known.description),
          boost: 1
        }
      : { label: name, type: 'variable' }
  })
}

/** A tooltip's text: a line of template code, then what it means, if anything. */
function tooltipContent(code: string, meaning?: string): HTMLElement {
  const dom = document.createElement('div')
  dom.append(Object.assign(document.createElement('code'), { textContent: code }))
  if (meaning) dom.append(Object.assign(document.createElement('p'), { textContent: meaning }))
  return dom
}

async function hoverContent(place: TemplatePlace, variables: Variables) {
  if (place.kind === 'variable') {
    const known = describe(variables, place.word)
    return (
      known && tooltipContent(`${place.word}: ${known.type} = ${known.sample}`, known.description)
    )
  }
  if (place.kind !== 'filter') return null
  const filters = await loadPromptFilters()
  const example = filters.find(({ name }) => name === place.word)?.example
  return example ? tooltipContent(example) : null
}

/**
 * Help writing a Knap template, reading it with Knap's own tokenizer (`templatePlace`):
 * completion of tags after `{%`, filters after `|`, and the variables in scope elsewhere; a
 * hover with what a variable holds and its sample, or a filter's example; and braces that close as they open.
 * Keys the desktop menu takes are left out (`withoutMenuKeys`).
 */
export function templateAssist(variables: Variables): Extension[] {
  const complete = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const place = await templatePlace(context.state.sliceDoc(0, context.pos))
    if (!place || (!place.word && !context.explicit && place.kind === 'variable')) return null
    return { from: place.from, options: await completions(place, variables), validFor: /^\w*$/ }
  }

  const hover = hoverTooltip(async (view, pos): Promise<Tooltip | null> => {
    const word = view.state.wordAt(pos)
    if (!word) return null
    const place = await templatePlace(view.state.sliceDoc(0, word.to))
    if (place?.from !== word.from) return null
    const dom = await hoverContent(place, variables)
    if (!dom) return null
    return { pos: word.from, end: word.to, above: true, create: () => ({ dom }) }
  })

  return [
    autocompletion({ override: [complete] }),
    hover,
    closeBrackets(),
    keymap.of(withoutMenuKeys([...closeBracketsKeymap, ...completionKeymap], appMenuShortcuts()))
  ]
}
