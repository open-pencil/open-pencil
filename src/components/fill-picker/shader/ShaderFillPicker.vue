<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'

import type { ShaderPreset } from '@open-pencil/scene-graph'
import {
  addShaderEffect,
  canDrawShaders,
  loadShaderCatalog,
  moveShaderEffect,
  parseShaderPreset,
  removeShaderEffect,
  setShaderEffectProp,
  shaderPresetJSON,
  useI18n,
  type ShaderEffect
} from '@open-pencil/vue'

import ShaderEffectControls from '@/components/fill-picker/shader/ShaderEffectControls.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'

/**
 * Edits a shader paint's preset: its stack of effects, the props of the one selected, and the
 * preset as JSON, which also takes a preset copied from shaders.com.
 */
const { preset } = defineProps<{ preset: ShaderPreset }>()
const emit = defineEmits<{ update: [preset: ShaderPreset] }>()
const { panels, common } = useI18n()

const catalog = shallowRef<ShaderEffect[]>([])
onMounted(async () => {
  catalog.value = await loadShaderCatalog()
})

const selected = ref(preset.components.length - 1)
watch(
  () => preset.components.length,
  (length) => {
    selected.value = Math.min(selected.value, length - 1)
  }
)

/** The effects top first, as layers are listed: the last one drawn is on top. */
const stack = computed(() =>
  preset.components.map((component, index) => ({ component, index })).reverse()
)
const selectedComponent = computed(() => preset.components.at(selected.value))
const selectedEffect = computed(() =>
  catalog.value.find((effect) => effect.name === selectedComponent.value?.type)
)

const effectOptions = computed(() =>
  catalog.value.map((effect) => ({
    value: effect.name,
    label: effect.name,
    group: effect.category,
    description: effect.description
  }))
)
const adding = ref('')
function add(type: string) {
  if (!type) return
  emit('update', addShaderEffect(preset, type))
  selected.value = preset.components.length
  adding.value = ''
}

function move(index: number, by: number) {
  emit('update', moveShaderEffect(preset, index, index + by))
  selected.value = index + by
}

const editingJSON = ref(false)
const json = ref('')
const invalid = ref(false)
function toggleJSON() {
  editingJSON.value = !editingJSON.value
  json.value = shaderPresetJSON(preset)
  invalid.value = false
}
function applyJSON() {
  const parsed = parseShaderPreset(json.value)
  invalid.value = parsed === null
  if (!parsed) return
  emit('update', parsed)
  selected.value = parsed.components.length - 1
  editingJSON.value = false
}
</script>

<template>
  <div class="flex flex-col gap-2" data-test-id="shader-fill-picker">
    <p v-if="!canDrawShaders()" class="text-[11px] text-muted" data-test-id="shader-no-webgpu">
      {{ panels.shaderNeedsWebGPU }}
    </p>

    <ul class="flex flex-col gap-0.5" data-test-id="shader-effects">
      <li
        v-for="{ component, index } in stack"
        :key="index"
        class="flex items-center gap-0.5 rounded px-1"
        :class="index === selected ? 'bg-hover text-surface' : 'text-muted'"
      >
        <button
          type="button"
          class="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-1 text-left text-xs text-inherit"
          :data-shader-effect="component.type"
          @click="selected = index"
        >
          {{ component.type }}
        </button>
        <IconButton
          :label="panels.moveShaderEffectUp"
          :disabled="index === preset.components.length - 1"
          @click="move(index, 1)"
        >
          <icon-lucide-chevron-up class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.moveShaderEffectDown"
          :disabled="index === 0"
          @click="move(index, -1)"
        >
          <icon-lucide-chevron-down class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.removeShaderEffect"
          :disabled="preset.components.length === 1"
          @click="emit('update', removeShaderEffect(preset, index))"
        >
          <icon-lucide-minus class="size-3.5" />
        </IconButton>
      </li>
    </ul>

    <AppCombobox
      v-model="adding"
      :options="effectOptions"
      :label="panels.addShaderEffect"
      :placeholder="panels.addShaderEffect"
      :search-placeholder="panels.searchShaderEffects"
      :empty-label="panels.noShaderEffects"
      data-test-id="shader-add-effect"
      @update:model-value="add"
    />

    <ShaderEffectControls
      v-if="selectedEffect && selectedComponent && !editingJSON"
      class="max-h-[50vh] overflow-y-auto pr-1"
      :effect="selectedEffect"
      :component="selectedComponent"
      @set="(key, value) => emit('update', setShaderEffectProp(preset, selected, key, value))"
    />

    <div class="flex flex-col gap-1.5">
      <AppButton variant="ghost" size="sm" data-test-id="shader-preset-toggle" @click="toggleJSON">
        <icon-lucide-braces class="size-3.5" />
        {{ panels.shaderPreset }}
      </AppButton>
      <template v-if="editingJSON">
        <AppTextarea v-model="json" :rows="8" class="font-mono text-[11px]" />
        <p v-if="invalid" class="text-[11px] text-danger">{{ panels.invalidShaderPreset }}</p>
        <div class="flex justify-end gap-1.5">
          <AppButton variant="ghost" size="sm" @click="editingJSON = false">
            {{ common.cancel }}
          </AppButton>
          <AppButton size="sm" data-test-id="shader-preset-apply" @click="applyJSON">
            {{ panels.applyShaderPreset }}
          </AppButton>
        </div>
      </template>
    </div>
  </div>
</template>
