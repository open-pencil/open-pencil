import { useFilter } from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'

/**
 * Options for {@link useFontPicker}.
 */
export interface UseFontPickerOptions {
  /** Writable model for the selected font family. */
  modelValue: { value: string }
  /** Async source for available font families. */
  listFamilies: () => Promise<string[]>
  /** Optional callback fired after a family is selected. */
  onSelect?: (family: string) => void
}

/**
 * Returns searchable font-picker state and selection helpers.
 */
export function useFontPicker(options: UseFontPickerOptions) {
  const families = ref<string[]>([])
  const searchTerm = ref('')
  const open = ref(false)

  const { contains } = useFilter({ sensitivity: 'base' })
  const filtered = computed(() => {
    if (!searchTerm.value) return families.value
    return families.value.filter((family) => contains(family, searchTerm.value))
  })

  onMounted(async () => {
    families.value = await options.listFamilies()
  })

  watch(open, (isOpen) => {
    if (isOpen) searchTerm.value = ''
  })

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
    select
  }
}
