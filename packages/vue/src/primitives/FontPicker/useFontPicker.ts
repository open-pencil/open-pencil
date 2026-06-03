import { useFilter } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import type { FontFamilyOption } from '@inkly/core/text'

export type FontAccessState = 'unsupported' | 'prompt' | 'granted' | 'denied'
export type { FontFamilyOption, FontFamilySource } from '@inkly/core/text'

export interface FontAccessController {
  state: () => FontAccessState
  load: () => Promise<string[] | FontFamilyOption[]>
}

/**
 * Options for {@link useFontPicker}.
 */
export interface UseFontPickerOptions {
  /** Writable model for the selected font family. */
  modelValue: { value: string }
  /** Async source for available font families. */
  listFamilies: () => Promise<string[] | FontFamilyOption[]>
  /** Host-provided local-font permission controller. */
  localFontAccess?: FontAccessController
  /** Optional callback fired after a family is selected. */
  onSelect?: (family: string) => void
}

function normalizeOptions(items: string[] | FontFamilyOption[]): FontFamilyOption[] {
  return items.map((item) => (typeof item === 'string' ? { family: item, source: 'local' } : item))
}

/**
 * Returns searchable font-picker state and selection helpers.
 */
export function useFontPicker(options: UseFontPickerOptions) {
  const families = ref<FontFamilyOption[]>([])
  const searchTerm = ref('')
  const open = ref(false)
  const loading = ref(false)
  const accessState = ref<FontAccessState>(options.localFontAccess?.state() ?? 'granted')

  const { contains } = useFilter({ sensitivity: 'base' })
  const filtered = computed(() => {
    if (!searchTerm.value) return families.value
    return families.value.filter((option) => contains(option.family, searchTerm.value))
  })

  async function loadFamilies() {
    if (families.value.length > 0 || loading.value) return
    loading.value = true
    try {
      families.value = normalizeOptions(await options.listFamilies())
      accessState.value = options.localFontAccess?.state() ?? accessState.value
    } finally {
      loading.value = false
    }
  }

  watch(open, async (isOpen) => {
    if (!isOpen) return
    searchTerm.value = ''
    accessState.value = options.localFontAccess?.state() ?? accessState.value
    if (accessState.value === 'prompt') {
      await requestAccess()
      return
    }
    await loadFamilies()
  })

  async function requestAccess() {
    if (!options.localFontAccess || loading.value) return
    loading.value = true
    try {
      families.value = normalizeOptions(await options.localFontAccess.load())
      accessState.value = options.localFontAccess.state()
    } finally {
      loading.value = false
    }
  }

  function select(family: string) {
    options.modelValue.value = family
    options.onSelect?.(family)
    open.value = false
  }

  return {
    families,
    searchTerm,
    open,
    filtered,
    loading,
    accessState,
    requestAccess,
    select
  }
}
