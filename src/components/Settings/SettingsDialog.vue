<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import CloudStorageSection from '@/components/chat/ProviderSettings/CloudStorageSection.vue'
import SettingsAiPanel from '@/components/Settings/SettingsAiPanel.vue'
import { useDialogUI } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const cls = useDialogUI({
  content: 'flex max-h-[min(85vh,40rem)] w-[min(32rem,94vw)] flex-col overflow-hidden'
})
const open = ref(false)
const activeTab = ref<'cloud' | 'ai'>('cloud')
const cloudStorageSection = ref<{ saveCloud: () => void } | null>(null)
const aiPanel = ref<{ save: () => void } | null>(null)

function saveAll() {
  cloudStorageSection.value?.saveCloud()
  aiPanel.value?.save()
}

function onOpenChange(value: boolean) {
  if (!value) {
    saveAll()
  }
  open.value = value
}

function saveAndClose() {
  saveAll()
  open.value = false
}

const tabClass =
  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted transition-colors outline-none select-none hover:text-surface data-[state=active]:bg-hover data-[state=active]:text-surface'
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <button
        type="button"
        data-test-id="app-settings-trigger"
        class="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs font-medium text-surface shadow-sm transition-colors hover:bg-hover"
      >
        <icon-lucide-settings class="size-3.5 shrink-0 text-muted" />
        <span>{{ dialogs.settings }}</span>
      </button>
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent
        :class="cls.content"
        data-test-id="app-settings-dialog"
        @pointer-down-outside="
          (e: Event) => {
            const t = e.target as HTMLElement | null
            if (t?.closest('[role=listbox], [data-reka-popper-content-wrapper]')) {
              e.preventDefault()
            }
          }
        "
        @interact-outside="
          (e: Event) => {
            const t = e.target as HTMLElement | null
            if (t?.closest('[role=listbox], [data-reka-popper-content-wrapper]')) {
              e.preventDefault()
            }
          }
        "
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div class="min-w-0">
            <DialogTitle :class="cls.title">{{ dialogs.settings }}</DialogTitle>
            <DialogDescription :class="cls.description" class="mt-0.5">
              {{ dialogs.settingsDescription }}
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <button
              type="button"
              class="rounded p-1 text-muted hover:bg-hover hover:text-surface"
              data-test-id="app-settings-close"
              :aria-label="dialogs.close"
            >
              <icon-lucide-x class="size-4" />
            </button>
          </DialogClose>
        </header>

        <TabsRoot v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
          <div class="shrink-0 border-b border-border px-4 py-2">
            <TabsList class="inline-flex gap-0.5 rounded-lg bg-input p-0.5">
              <TabsTrigger
                value="cloud"
                :class="tabClass"
                data-test-id="settings-tab-cloud"
              >
                <icon-lucide-cloud class="size-3.5 shrink-0" />
                {{ dialogs.settingsTabCloud }}
              </TabsTrigger>
              <TabsTrigger value="ai" :class="tabClass" data-test-id="settings-tab-ai">
                <icon-lucide-sparkles class="size-3.5 shrink-0" />
                {{ dialogs.settingsTabAI }}
              </TabsTrigger>
            </TabsList>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <TabsContent value="cloud" class="mt-0 outline-none data-[state=inactive]:hidden">
              <CloudStorageSection ref="cloudStorageSection" />
            </TabsContent>
            <TabsContent value="ai" class="mt-0 outline-none data-[state=inactive]:hidden">
              <SettingsAiPanel ref="aiPanel" />
            </TabsContent>
          </div>
        </TabsRoot>

        <footer class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
            data-test-id="app-settings-done"
            @click="saveAndClose"
          >
            {{ dialogs.done }}
          </button>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
