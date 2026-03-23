import { useFilter } from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'

export interface UseFontPickerOptions {
  modelValue: { value: string }
  listFamilies: () => Promise<string[]>
  onSelect?: (family: string) => void
}

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
