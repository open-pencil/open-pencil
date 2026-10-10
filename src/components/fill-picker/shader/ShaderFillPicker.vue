<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, type ComponentPublicInstance } from 'vue'

import type { ShaderPreset } from '@open-pencil/scene-graph'
import {
  addShaderEffect,
  canDrawShaders,
  loadShaderCatalog,
  moveShaderEffect,
  parseShaderPreset,
  removeShaderEffect,
  setShaderEffectProp,
  shaderEffectLabel,
  shaderPresetJSON,
  useFlatReorderDrag,
  useI18n,
  type ShaderEffect
} from '@open-pencil/vue'

import ShaderEffectControls from '@/components/fill-picker/shader/ShaderEffectControls.vue'
import ShaderEffectThumb from '@/components/fill-picker/shader/ShaderEffectThumb.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'

/**
 * Edits a shader paint's preset as the properties panel edits effects: a list of the shader's
 * effects, top first, each with its type and settings, reordered by dragging; and the preset as
 * JSON, which also takes a preset copied from shaders.com.
 */
const { preset } = defineProps<{ preset: ShaderPreset }>()
const emit = defineEmits<{ update: [preset: ShaderPreset] }>()
const { panels, common } = useI18n()

const catalog = shallowRef<ShaderEffect[]>([])
onMounted(async () => {
  catalog.value = await loadShaderCatalog()
})
const effectsByName = computed(() => new Map(catalog.value.map((effect) => [effect.name, effect])))

const effectOptions = computed(() =>
  catalog.value.map((effect) => ({
    value: effect.name,
    label: shaderEffectLabel(effect.name),
    group: effect.category,
    description: effect.description
  }))
)

/** The effects top first, as the panel lists layers: the last one drawn is on top. */
const rows = computed(() =>
  preset.components
    .map((component, index) => ({
      id: String(index),
      index,
      component,
      effect: catalog.value.find((effect) => effect.name === component.type)
    }))
    .reverse()
)

const expanded = ref<number | null>(null)

function add() {
  emit('update', addShaderEffect(preset, 'Aurora'))
  expanded.value = preset.components.length
}

function remove(index: number) {
  emit('update', removeShaderEffect(preset, index))
  expanded.value = null
}

/** Changing an effect's type starts it from the new effect's own defaults. */
function setType(index: number, type: string) {
  if (preset.components[index]?.type === type) return
  emit('update', {
    ...preset,
    components: preset.components.map((component, at) => (at === index ? { type } : component))
  })
}

const reorder = useFlatReorderDrag({
  items: () => rows.value,
  // Rows run top first, so a row's place counts from the end of the preset's list.
  onMove: (id, target) => {
    const from = Number(id)
    emit('update', moveShaderEffect(preset, from, preset.components.length - 1 - target))
    expanded.value = null
  }
})

function setupRow(element: Element | ComponentPublicInstance | null, id: string) {
  reorder.setupItem(element instanceof HTMLElement ? element : null, () => ({ id }))
}

function dropPosition(id: string) {
  if (reorder.instructionTargetId.value !== id) return undefined
  return reorder.instruction.value?.operation === 'reorder-before' ? 'before' : 'after'
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
  expanded.value = null
  editingJSON.value = false
}
</script>

<template>
  <div class="flex flex-col gap-2" data-test-id="shader-fill-picker">
    <AppAlert
      v-if="!canDrawShaders()"
      tone="warning"
      :heading="panels.shaderNeedsWebGPU"
      data-test-id="shader-no-webgpu"
    />

    <div>
      <div class="mb-1 flex items-center justify-between">
        <span class="text-[11px] text-muted">{{ panels.effects }}</span>
        <div class="flex items-center">
          <IconButton
            :label="panels.shaderPreset"
            :data-active="editingJSON || undefined"
            data-test-id="shader-preset-toggle"
            @click="toggleJSON"
          >
            <icon-lucide-braces class="size-3" />
          </IconButton>
          <IconButton :label="panels.addShaderEffect" data-test-id="shader-add-effect" @click="add">
            <icon-lucide-plus class="size-3" />
          </IconButton>
        </div>
      </div>

      <div v-if="editingJSON" class="flex flex-col gap-1.5">
        <AppTextarea v-model="json" :rows="8" class="font-mono text-[11px]" />
        <AppAlert v-if="invalid" tone="error" :heading="panels.invalidShaderPreset" />
        <div class="flex justify-end gap-1.5">
          <AppButton variant="ghost" size="sm" @click="editingJSON = false">
            {{ common.cancel }}
          </AppButton>
          <AppButton size="sm" data-test-id="shader-preset-apply" @click="applyJSON">
            {{ panels.applyShaderPreset }}
          </AppButton>
        </div>
      </div>

      <div v-else class="flex flex-col" data-test-id="shader-effects">
        <div
          v-for="row in rows"
          :key="row.id"
          :ref="(element) => setupRow(element, row.id)"
          class="relative data-[dragging]:opacity-50"
          :data-dragging="reorder.draggingId.value === row.id || undefined"
          :data-shader-effect="row.component.type"
        >
          <div
            v-if="dropPosition(row.id)"
            class="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent"
            :class="dropPosition(row.id) === 'before' ? 'top-0' : 'bottom-0'"
          />
          <PanelItemRow>
            <div class="flex min-w-0 flex-1 items-center gap-1.5">
              <Tip
                :label="
                  expanded === row.index
                    ? panels.collapseEffectSettings
                    : panels.expandEffectSettings
                "
              >
                <button
                  type="button"
                  :aria-expanded="expanded === row.index"
                  :aria-label="
                    expanded === row.index
                      ? panels.collapseEffectSettings
                      : panels.expandEffectSettings
                  "
                  class="flex size-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border bg-input p-0"
                  @click="expanded = expanded === row.index ? null : row.index"
                >
                  <icon-lucide-sparkles class="size-3 text-muted" />
                </button>
              </Tip>
              <div class="min-w-0 flex-1">
                <AppCombobox
                  :model-value="row.component.type"
                  :options="effectOptions"
                  :label="panels.shader"
                  :search-placeholder="panels.searchShaderEffects"
                  :empty-label="panels.noShaderEffects"
                  :result-limit="catalog.length"
                  :ui="{ content: 'w-64' }"
                  @update:model-value="setType(row.index, $event)"
                >
                  <template #option="{ option }">
                    <ShaderEffectThumb :effect="effectsByName.get(option.value)" />
                    <span class="min-w-0 flex-1 truncate text-surface">{{ option.label }}</span>
                  </template>
                </AppCombobox>
              </div>
            </div>
            <template #rail="{ removeClass }">
              <Tip :label="panels.removeShaderEffect">
                <IconButton
                  :label="panels.removeShaderEffect"
                  :disabled="preset.components.length === 1"
                  :class="removeClass"
                  @click="remove(row.index)"
                >
                  <icon-lucide-minus class="size-3.5" />
                </IconButton>
              </Tip>
            </template>
          </PanelItemRow>
          <ShaderEffectControls
            v-if="expanded === row.index && row.effect"
            class="py-2"
            :effect="row.effect"
            :component="row.component"
            @set="
              (key, value) => emit('update', setShaderEffectProp(preset, row.index, key, value))
            "
          />
        </div>
      </div>
    </div>
  </div>
</template>
