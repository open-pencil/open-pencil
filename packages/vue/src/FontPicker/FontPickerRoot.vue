<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useFilter } from 'reka-ui'

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const { listFamilies } = defineProps<{
  listFamilies: () => Promise<string[]>
}>()

const families = ref<string[]>([])
const searchTerm = ref('')
const open = ref(false)

const { contains } = useFilter({ sensitivity: 'base' })
const filtered = computed(() => {
  if (!searchTerm.value) return families.value
  return families.value.filter((f) => contains(f, searchTerm.value))
})

onMounted(async () => {
  families.value = await listFamilies()
})

watch(open, (isOpen) => {
  if (isOpen) searchTerm.value = ''
})

function select(family: string) {
  modelValue.value = family
  emit('select', family)
  open.value = false
}
</script>

<template>
  <slot
    :families="families"
    :filtered="filtered"
    :search-term="searchTerm"
    :open="open"
    :model-value="modelValue"
    :select="select"
    :set-search-term="(v: string) => (searchTerm = v)"
    :set-open="(v: boolean) => (open = v)"
  />
</template>
