<script setup lang="ts">
import { computed } from 'vue'

import { useVisibilityBindingProvider } from '@open-pencil/vue/controls/binding-provider'
import { useI18n } from '@open-pencil/vue/i18n'
import { BindableValueRoot } from '@open-pencil/vue/primitives/BindableValue'

import FieldBindingPicker from '@/components/properties/binding/FieldBindingPicker.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

/**
 * The Appearance eye with what binds visibility. While a variable decides it, the eye is
 * disabled, as in Figma: detaching the variable is what hands visibility back to the eye.
 */
const { nodeId, visibility } = defineProps<{
  /** The selected layer; several selected layers get the eye alone. */
  nodeId?: string
  visibility: 'visible' | 'hidden' | 'mixed'
}>()
const emit = defineEmits<{ toggle: [] }>()

const { panels } = useI18n()
const provider = useVisibilityBindingProvider()
const targets = computed(() => (nodeId ? [{ nodeId, path: 'visible' }] : []))
</script>

<template>
  <BindableValueRoot
    v-if="nodeId"
    v-slot="binding"
    :provider="provider"
    :targets="targets"
    :value="visibility === 'visible'"
  >
    <FieldBindingPicker :node-id="nodeId" field="VISIBLE">
      <template #anchor="{ open }">
        <!-- A disabled button gets no events, so the right-click that opens the list lands here. -->
        <span class="inline-flex" @contextmenu.prevent="open">
          <IconButton
            :label="panels.toggleVisibility"
            :active="visibility === 'hidden'"
            :disabled="binding.state !== 'unbound'"
            class="disabled:pointer-events-none"
            @click="emit('toggle')"
          >
            <icon-lucide-eye v-if="visibility === 'visible'" class="size-3.5" />
            <icon-lucide-eye-off v-else class="size-3.5" />
          </IconButton>
        </span>
      </template>
    </FieldBindingPicker>
  </BindableValueRoot>
  <IconButton
    v-else
    :label="panels.toggleVisibility"
    :active="visibility === 'hidden'"
    @click="emit('toggle')"
  >
    <icon-lucide-eye v-if="visibility === 'visible'" class="size-3.5" />
    <icon-lucide-eye-off v-else-if="visibility === 'hidden'" class="size-3.5" />
    <icon-lucide-eye v-else class="size-3.5 opacity-50" />
  </IconButton>
</template>
