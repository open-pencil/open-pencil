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

/** A prompt's variables, with the sample values its preview is filled with. */
type Samples = Readonly<Record<string, unknown>>

/** A variable's type and sample, as a template would write the sample. */
function describe(samples: Samples, name: string): { type: string; sample: string } | null {
  if (!Object.hasOwn(samples, name)) return null
  const value = samples[name]
  return { type: typeof value, sample: JSON.stringify(value) }
}

async function completions(place: TemplatePlace, samples: Samples): Promise<Completion[]> {
  if (place.kind === 'tag') return TEMPLATE_TAGS.map((label) => ({ label, type: 'keyword' }))
  if (place.kind === 'filter') {
    const filters = await loadPromptFilters()
    return filters.map(({ name, example }) => ({ label: name, type: 'function', detail: example }))
  }
  const names = new Set([...Object.keys(samples), ...place.defined])
  return [...names].map((name) => {
    const known = describe(samples, name)
    return known
      ? { label: name, type: 'variable', detail: known.type, info: known.sample, boost: 1 }
      : { label: name, type: 'variable' }
  })
}

async function hoverText(place: TemplatePlace, samples: Samples): Promise<string | null> {
  if (place.kind === 'variable') {
    const known = describe(samples, place.word)
    return known && `${place.word}: ${known.type} = ${known.sample}`
  }
  if (place.kind !== 'filter') return null
  const filters = await loadPromptFilters()
  return filters.find(({ name }) => name === place.word)?.example ?? null
}

/**
 * Help writing a Knap template, reading it with Knap's own tokenizer (`templatePlace`):
 * completion of tags after `{%`, filters after `|`, and the variables in scope elsewhere; a
 * hover with a variable's sample or a filter's example; and braces that close as they open.
 * Keys the desktop menu takes are left out (`withoutMenuKeys`).
 */
export function templateAssist(samples: Samples): Extension[] {
  const complete = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const place = await templatePlace(context.state.sliceDoc(0, context.pos))
    if (!place || (!place.word && !context.explicit && place.kind === 'variable')) return null
    return { from: place.from, options: await completions(place, samples), validFor: /^\w*$/ }
  }

  const hover = hoverTooltip(async (view, pos): Promise<Tooltip | null> => {
    const word = view.state.wordAt(pos)
    if (!word) return null
    const place = await templatePlace(view.state.sliceDoc(0, word.to))
    if (place?.from !== word.from) return null
    const text = await hoverText(place, samples)
    if (!text) return null
    return {
      pos: word.from,
      end: word.to,
      above: true,
      create: () => {
        const dom = document.createElement('div')
        dom.textContent = text
        return { dom }
      }
    }
  })

  return [
    autocompletion({ override: [complete] }),
    hover,
    closeBrackets(),
    keymap.of(withoutMenuKeys([...closeBracketsKeymap, ...completionKeymap], appMenuShortcuts()))
  ]
}
