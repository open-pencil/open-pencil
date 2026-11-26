import { watchDebounced } from '@vueuse/core'
import { computed, ref } from 'vue'

import { BUILT_IN_DESIGN_PROMPT } from '@/app/ai/chat/system-prompt'
import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updatePromptPreferences,
  type DesignPromptMode
} from '@/app/settings/preferences/store'

import { PROMPT_DEFINITIONS, type TemplatePrompt } from '../definitions'
import { checkTemplate, previewPrompt, type TemplateCheck } from '../engine'

/** How long typing settles before a template is checked and previewed again. */
const CHECK_DELAY_MS = 250

/**
 * One template prompt in Settings: the text shown, the person's own or OpenPencil's, what is
 * wrong with it, and how it reads filled with sample values. Text equal to OpenPencil's is saved
 * as no change, so a later update to the built-in prompt still reaches it.
 */
export function useTemplatePromptSetting(id: TemplatePrompt) {
  const builtIn = PROMPT_DEFINITIONS[id].template
  const text = computed({
    get: () => appPreferences.value.prompts[id] ?? builtIn,
    set: (value: string) => updatePromptPreferences({ [id]: value === builtIn ? null : value })
  })
  const modified = computed(() => appPreferences.value.prompts[id] !== null)
  const samples: Readonly<Record<string, unknown>> = PROMPT_DEFINITIONS[id].variables
  const check = ref<TemplateCheck>({ errors: [], unknownVariables: [] })
  const preview = ref('')

  async function refresh(template: string): Promise<void> {
    const [checked, previewed] = await Promise.all([
      checkTemplate(id, template),
      previewPrompt(id, template)
    ])
    // A slower check of older text must not replace a newer one's.
    if (template !== text.value) return
    check.value = checked
    preview.value = previewed
  }

  watchDebounced(text, (template) => void refresh(template), {
    debounce: CHECK_DELAY_MS,
    immediate: true
  })

  return {
    text,
    modified,
    samples,
    check,
    preview,
    reset: () => updatePromptPreferences({ [id]: null })
  }
}

/** The Design prompt in Settings: the person's instructions, and whether they replace OpenPencil's. */
export function useDesignPromptSetting() {
  const defaults = DEFAULT_APP_PREFERENCES.prompts.design
  const design = computed(() => appPreferences.value.prompts.design)
  const text = computed({
    get: () => design.value.text,
    set: (value: string) => updatePromptPreferences({ design: { ...design.value, text: value } })
  })
  const mode = computed({
    get: () => design.value.mode,
    set: (value: DesignPromptMode) =>
      updatePromptPreferences({ design: { ...design.value, mode: value } })
  })
  const modified = computed(
    () => design.value.text !== defaults.text || design.value.mode !== defaults.mode
  )
  return {
    text,
    mode,
    modified,
    builtIn: BUILT_IN_DESIGN_PROMPT,
    /** Puts OpenPencil's instructions in the field, to edit rather than start empty. */
    startFromBuiltIn: () => {
      text.value = BUILT_IN_DESIGN_PROMPT
    },
    reset: () => updatePromptPreferences({ design: { ...defaults } })
  }
}
