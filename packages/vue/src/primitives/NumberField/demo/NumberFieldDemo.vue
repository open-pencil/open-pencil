<script setup lang="ts">
import { ref } from 'vue'

import { MIXED } from '#vue/controls/node-props/use'

import NumberFieldInput from '#vue/primitives/NumberField/NumberFieldInput.vue'
import NumberFieldRoot from '#vue/primitives/NumberField/NumberFieldRoot.vue'
import NumberFieldValue from '#vue/primitives/NumberField/NumberFieldValue.vue'
import {
  NumberFieldLeading,
  NumberFieldMenu,
  NumberFieldTrailing,
  NumberFieldUnit
} from '#vue/primitives/NumberField/parts'

const value = ref<number | symbol>(24)
const mixed = ref<number | symbol>(MIXED)
const disabled = ref<number | symbol>(16)
const bound = ref<number | symbol>(8)
</script>

<template>
  <div
    class="w-full max-w-[520px] rounded-lg border border-[var(--vp-c-divider)] bg-[var(--vp-c-bg-soft)] p-5 text-[var(--vp-c-text-1)]"
  >
    <div>
      <p class="mb-1 text-xs font-semibold">Interactive anatomy</p>
      <p class="mb-2 text-[11px] text-[var(--vp-c-text-2)]">Try +10, *2, 50%, or 12*8+4</p>
      <NumberFieldRoot
        v-slot="{ attrs, editing, actions }"
        v-model="value"
        :min="0"
        :max="200"
        :step="2"
        aria-label="Interactive number field"
      >
        <div
          v-bind="attrs"
          data-story-control
          class="flex h-[26px] w-56 items-center overflow-hidden rounded border border-transparent bg-[var(--vp-c-bg-alt)] text-xs outline-none focus-within:border-[var(--vp-c-brand-1)]"
          @pointerdown="!editing && actions.startScrub($event)"
        >
          <NumberFieldLeading class="px-2 text-[var(--vp-c-text-2)]">W</NumberFieldLeading>
          <NumberFieldInput
            data-test-id="interactive-number-input"
            class="min-w-0 flex-1 border-0 bg-transparent outline-none"
          />
          <NumberFieldValue class="min-w-0 flex-1 truncate" />
          <NumberFieldUnit class="pr-1 text-[var(--vp-c-text-2)]">px</NumberFieldUnit>
          <NumberFieldTrailing
            class="flex size-[26px] items-center justify-center text-[var(--vp-c-text-2)]"
          >
            R
          </NumberFieldTrailing>
          <NumberFieldMenu
            class="flex size-[26px] items-center justify-center text-[var(--vp-c-text-2)]"
          >
            M
          </NumberFieldMenu>
        </div>
      </NumberFieldRoot>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
      <div>
        <p class="mb-1 text-[11px] text-[var(--vp-c-text-2)]">Mixed</p>
        <NumberFieldRoot
          v-slot="{ attrs, editing, actions }"
          v-model="mixed"
          aria-label="Mixed number field"
        >
          <div
            v-bind="attrs"
            class="flex h-[26px] min-w-0 items-center overflow-hidden rounded border border-transparent bg-[var(--vp-c-bg-alt)] px-2 text-xs outline-none focus-within:border-[var(--vp-c-brand-1)]"
            @pointerdown="!editing && actions.startScrub($event)"
          >
            <NumberFieldInput class="min-w-0 flex-1 border-0 bg-transparent outline-none" />
            <NumberFieldValue class="text-[var(--vp-c-text-2)]" />
          </div>
        </NumberFieldRoot>
      </div>

      <div>
        <p class="mb-1 text-[11px] text-[var(--vp-c-text-2)]">Disabled</p>
        <NumberFieldRoot
          v-slot="{ attrs }"
          v-model="disabled"
          aria-label="Disabled number field"
          disabled
        >
          <div
            v-bind="attrs"
            class="flex h-[26px] min-w-0 items-center overflow-hidden rounded border border-transparent bg-[var(--vp-c-bg-alt)] px-2 text-xs text-[var(--vp-c-text-2)] opacity-60"
          >
            <NumberFieldValue />
          </div>
        </NumberFieldRoot>
      </div>

      <div>
        <p class="mb-1 text-[11px] text-[var(--vp-c-text-2)]">Bound</p>
        <NumberFieldRoot
          v-slot="{ attrs, editing, actions }"
          v-model="bound"
          aria-label="Bound number field"
          bound
        >
          <div
            v-bind="attrs"
            class="flex h-[26px] min-w-0 items-center overflow-hidden rounded border border-transparent bg-[var(--vp-c-bg-alt)] px-2 text-xs text-[var(--vp-c-brand-1)] outline-none focus-within:border-[var(--vp-c-brand-1)]"
            @pointerdown="!editing && actions.startScrub($event)"
          >
            <NumberFieldInput class="min-w-0 flex-1 border-0 bg-transparent outline-none" />
            <NumberFieldValue />
            <NumberFieldUnit class="ml-1">gap/md</NumberFieldUnit>
          </div>
        </NumberFieldRoot>
      </div>
    </div>
  </div>
</template>
