<script setup lang="ts">
import { nextTick, watch } from 'vue'

import { useI18n, useViewportKind } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { openLibraryReview, openPublishLibraryDialog, useLibraryService } from '@/app/libraries'
import { useLibraryManager } from '@/components/libraries/useLibraryManager'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import AppTabsContent from '@/components/ui/tabs/AppTabsContent.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { initialSection = 'browse' } = defineProps<{
  initialSection?: 'browse' | 'updates'
}>()
const open = defineModel<boolean>({ required: true })
const editor = useEditorStore()
const service = useLibraryService()
const { isMobile } = useViewportKind()
const { panels, common } = useI18n()

async function openPublish() {
  open.value = false
  await nextTick()
  openPublishLibraryDialog()
}
const {
  section,
  loading,
  showAllPages,
  applying,
  visibleUpdateGroups,
  setSource,
  toggleLibrary,
  preferLibrary,
  updateAsset,
  updateAll
} = useLibraryManager(open, editor, service)
watch(open, (isOpen) => {
  if (isOpen) section.value = initialSection
})
function selectSource(value: string) {
  if (value === 'local' || value === 'storage') void setSource(value)
}

function reviewUpdate(group: (typeof visibleUpdateGroups.value)[number]) {
  const initialInstanceId = group.instanceIds[0]
  if (!initialInstanceId) return
  openLibraryReview({
    libraryId: group.libraryId,
    assetKey: group.assetKey,
    instanceIds: group.instanceIds,
    initialInstanceId
  })
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="lg" height="tall" data-test-id="asset-libraries-dialog">
    <AppDialogHeader
      :heading="panels.manageLibraries"
      :description="panels.manageLibrariesDescription"
      :close-label="common.close"
    >
      <template #actions>
        <AppButton color="primary" variant="link" class="ml-auto" @click="openPublish">
          {{ panels.publishLibrary }}
        </AppButton>
      </template>
    </AppDialogHeader>
    <AppTabsRoot v-model="section" :orientation="isMobile ? 'horizontal' : 'vertical'">
      <AppTabsList :label="panels.manageLibraries">
        <AppTabsTrigger value="browse">
          <template #leading><icon-lucide-library class="size-3.5" /></template>
          {{ panels.browseLibraries }}
        </AppTabsTrigger>
        <AppTabsTrigger value="updates">
          <template #leading><icon-lucide-refresh-cw class="size-3.5" /></template>
          {{ panels.libraryUpdates }}
          <template v-if="visibleUpdateGroups.length" #trailing>
            <span class="rounded-full bg-accent px-1.5 text-[10px] text-white">{{
              visibleUpdateGroups.length
            }}</span>
          </template>
        </AppTabsTrigger>
      </AppTabsList>
      <AppTabsContent value="browse" as-child>
        <AppDialogBody>
          <SegmentedControl
            required
            class="mb-4"
            :model-value="service.catalogSource"
            :label="panels.browseLibraries"
            :options="[
              { value: 'local', label: panels.localLibraries },
              { value: 'storage', label: panels.storageLibraries }
            ]"
            @update:model-value="selectSource"
          />
          <div
            v-for="library in service.summaries.value"
            :key="library.libraryId"
            class="flex items-center gap-3 border-b border-border py-3"
          >
            <icon-lucide-library class="size-4 text-component" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs text-surface">{{ library.name }}</p>
              <p class="text-[10px] text-muted">
                {{ panels.libraryAssetCount({ count: library.assetCount }) }}
              </p>
            </div>
            <IconButton
              v-if="editor.graph.enabledLibraries.get(library.libraryId)?.enabled"
              :label="panels.preferLibrary"
              @click="preferLibrary(library.libraryId)"
            >
              <icon-lucide-star class="size-4" />
            </IconButton>
            <AppButton variant="outline" @click="toggleLibrary(library.libraryId)">
              {{
                editor.graph.enabledLibraries.get(library.libraryId)?.enabled
                  ? panels.disableLibrary
                  : panels.enableLibrary
              }}
            </AppButton>
          </div>
          <AppPlaceholder
            v-if="!loading && service.summaries.value.length === 0"
            :label="panels.noLibraries"
            size="compact"
          />
        </AppDialogBody>
      </AppTabsContent>
      <AppTabsContent value="updates" class="flex flex-col overflow-hidden">
        <AppDialogBody>
          <h3 class="mb-3 text-sm font-semibold text-surface">{{ panels.libraryUpdates }}</h3>
          <div
            v-for="asset in visibleUpdateGroups"
            :key="`${asset.libraryId}:${asset.assetKey}`"
            class="flex items-center gap-3 border-b border-border py-3"
          >
            <icon-lucide-component class="size-4 text-component" />
            <div class="min-w-0 flex-1">
              <button type="button" class="block w-full text-left" @click="reviewUpdate(asset)">
                <p class="truncate text-xs text-surface">{{ asset.name }}</p>
                <p data-test-id="library-update-instance-count" class="text-[10px] text-muted">
                  {{ panels.libraryInstanceCount({ count: asset.instanceIds.length }) }}
                </p>
              </button>
            </div>
            <AppButton variant="outline" :disabled="applying !== null" @click="updateAsset(asset)">
              {{ panels.updateLibraryAsset }}
            </AppButton>
          </div>
          <AppPlaceholder
            v-if="visibleUpdateGroups.length === 0"
            :label="panels.noLibraryUpdates"
            size="compact"
          />
        </AppDialogBody>
        <AppDialogFooter :ui="{ footer: 'justify-between' }">
          <AppSwitch v-model="showAllPages" :label="panels.showUpdatesForAllPages" />
          <AppButton
            color="primary"
            variant="solid"
            :disabled="visibleUpdateGroups.length === 0 || applying !== null"
            @click="updateAll"
          >
            {{ panels.updateAll }}
          </AppButton>
        </AppDialogFooter>
      </AppTabsContent>
    </AppTabsRoot>
  </AppDialogRoot>
</template>
