<script setup lang="ts">
import { computed } from 'vue'

import { useStatusMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { openStatusesDialog } from '@/app/editor/statuses/dialog'
import { useSelectedStatuses } from '@/app/editor/statuses/selection'
import StatusDot from '@/components/statuses/StatusDot.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

/** The status of the selected sections, frames, components, sets and instances. */
const store = useEditorStore()
const messages = useStatusMessages()
const { targets, eligible, workflow, state, stateId, mixed, hidden, setState, remove } =
  useSelectedStatuses()

const options = computed(() =>
  workflow.value.states.map((entry) => ({ value: entry.id, label: entry.name }))
)
const colorOf = (id: string) => workflow.value.states.find((entry) => entry.id === id)?.color
const hasStatus = computed(() => stateId.value !== '' || mixed.value)
const setFor = computed(() =>
  eligible.value.length < targets.value.length
    ? messages.value.setFor({
        count: String(eligible.value.length),
        total: String(targets.value.length)
      })
    : ''
)
</script>

<template>
  <PanelSection
    v-if="eligible.length > 0 || hasStatus || hidden"
    :label="messages.status"
    :empty="!hasStatus && !hidden"
    data-test-id="status-section"
  >
    <template #actions>
      <IconButton
        :label="messages.editStatuses"
        data-test-id="status-edit"
        @click="openStatusesDialog(store)"
      >
        <icon-lucide-settings-2 class="size-3.5" />
      </IconButton>
      <IconButton
        v-if="hasStatus"
        :label="messages.removeStatus"
        data-test-id="status-remove"
        @click="remove"
      >
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
      <AppSelect
        v-else-if="eligible.length > 0"
        :model-value="stateId"
        :options="options"
        :label="messages.addStatus"
        @update:model-value="setState(String($event))"
      >
        <template #trigger>
          <IconButton :label="messages.addStatus" data-test-id="status-add">
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
        </template>
        <template #option="{ option }">
          <span class="flex items-center gap-2">
            <StatusDot :color="colorOf(String(option.value))" />
            {{ option.label }}
          </span>
        </template>
      </AppSelect>
    </template>

    <template v-if="hasStatus">
      <div class="flex items-center gap-2">
        <StatusDot :color="state?.color" />
        <AppSelect
          :model-value="stateId"
          :options="options"
          :label="messages.status"
          :placeholder="messages.mixed"
          :ui="{ trigger: 'w-auto flex-1' }"
          data-test-id="status-select"
          @update:model-value="setState(String($event))"
        >
          <template #option="{ option }">
            <span class="flex items-center gap-2">
              <StatusDot :color="colorOf(String(option.value))" />
              {{ option.label }}
            </span>
          </template>
        </AppSelect>
      </div>
      <p v-if="setFor" class="mt-1 text-[11px] text-muted">{{ setFor }}</p>
    </template>

    <p v-else-if="hidden" class="mt-1 text-[11px] text-muted" data-test-id="status-hidden">
      {{
        messages.hiddenInside({
          state: hidden.state?.name ?? '',
          layer: hidden.inside?.name ?? ''
        })
      }}
      <button
        class="cursor-pointer border-none bg-transparent p-0 text-[11px] text-accent hover:underline"
        @click="remove"
      >
        {{ messages.remove }}
      </button>
    </p>
  </PanelSection>
</template>
