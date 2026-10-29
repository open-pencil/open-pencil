<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, onMounted, useTemplateRef } from 'vue'

import type { DocumentVersion } from '@open-pencil/cloud/contract'
import { useCloudMessages } from '@open-pencil/vue/i18n'

import { canLinkToVersions, cloudVersionLinkURL } from '@/app/cloud/documents/link'
import { duplicateVersion, editVersion, restoreVersion } from '@/app/cloud/versions/actions'
import {
  closeVersionHistory,
  openVersionDialog,
  previewVersion,
  showCurrentVersion,
  versionHistoryOf,
  versionsChanged
} from '@/app/cloud/versions/history'
import { useVersionList } from '@/app/cloud/versions/list'
import { useEditorStore } from '@/app/editor/active-store'
import { useDateFormat } from '@/app/i18n/date'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'

import CloudVersionListItem from './CloudVersionListItem.vue'
import { cloudVersions } from './ui'

/**
 * Version history, taking the right sidebar as in Figma: Current version first, then the
 * document's versions, newest first. Choosing one shows it read-only in place of the document.
 */
const shown = useEditorStore()
const t = useCloudMessages()
const ui = cloudVersions()
const menuCls = useMenuUI({ content: 'min-w-52', item: 'justify-start gap-2' })
const filterItem = menuItem({ justify: 'start', class: 'relative pl-7' })

const list = useVersionList(shown)
const listElement = useTemplateRef<HTMLUListElement>('listElement')
// Choosing a version remounts the panel; it opens where the list was scrolled.
onMounted(() => {
  if (listElement.value) listElement.value.scrollTop = list.scrollTop.value
})
function rememberScroll() {
  list.scrollTop.value = listElement.value?.scrollTop ?? 0
}
const history = computed(() => versionHistoryOf(shown))
const selectedId = computed(() => history.value?.preview?.version.id ?? null)

const dates = useDateFormat()
/** An autosave goes by when it was made, as Figma titles it: the time today, else with the date. */
const autosaveTitle = (at: string) => dates.timeOrDay(at)

function titleOf(version: DocumentVersion) {
  if (version.name) return version.name
  if (version.restoredFromVersionId) {
    const source = list.restoredFrom(version)?.name
    return source ? t.value.restoredVersion({ name: source }) : t.value.restoredVersionUnnamed
  }
  return autosaveTitle(version.createdAt)
}

function descriptionOf(version: DocumentVersion) {
  return version.description ?? list.restoredFrom(version)?.description ?? null
}

async function select(version: DocumentVersion) {
  await previewVersion(shown, version)
  const history = versionHistoryOf(shown)
  if (history?.failed) toast.error(t.value.versionFailed)
  else if (history?.preview?.version.id === version.id) {
    toast.info(t.value.viewingVersion({ name: titleOf(version) }))
  }
}

async function run(action: () => Promise<unknown>) {
  // A restore closes the preview, after which `shown` no longer leads to its document.
  const document = versionHistoryOf(shown)?.store ?? shown
  try {
    await action()
    versionsChanged(document)
  } catch (error) {
    console.warn('[Cloud] Changing the version history failed:', error)
    toast.error(t.value.versionChangeFailed)
  }
}

const restore = (version: DocumentVersion) => run(() => restoreVersion(shown, version))
const duplicate = (version: DocumentVersion) =>
  run(() =>
    duplicateVersion(
      shown,
      version,
      t.value.versionCopyName({ name: list.document.state.documentName })
    )
  )
const deleteInfo = (version: DocumentVersion) =>
  run(() => editVersion(shown, version, { name: null, description: '' }))

const { copy } = useClipboard({ legacy: true })
// A server that advertises no editor has no address to link to.
const linkable = computed(() => canLinkToVersions(shown))

async function copyLink(version: DocumentVersion) {
  const url = cloudVersionLinkURL(shown, version.id)
  if (!url) return
  await copy(url)
  toast.info(t.value.shareLinkCopied)
}

function setScope(value: unknown) {
  list.onlyYours.value = value === 'yours'
}
</script>

<template>
  <section :class="ui.panel()" :aria-label="t.versionHistory" data-slot="version-history">
    <PanelHeader>
      <template #icon><icon-lucide-history class="size-3.5" /></template>
      {{ t.versionHistory }}
      <template #actions>
        <DropdownMenuRoot :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton
              :label="t.versionFilter"
              :active="list.onlyYours.value || !list.showAutosaves.value"
            >
              <icon-lucide-list-filter class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent :class="menuCls.content" align="end" :side-offset="4">
              <MenuScrollArea>
                <DropdownMenuRadioGroup
                  :model-value="list.onlyYours.value ? 'yours' : 'all'"
                  @update:model-value="setScope"
                >
                  <DropdownMenuRadioItem value="all" :class="filterItem">
                    <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                      <icon-lucide-check class="size-3.5" />
                    </DropdownMenuItemIndicator>
                    {{ t.versionsAll }}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="yours" :class="filterItem">
                    <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                      <icon-lucide-check class="size-3.5" />
                    </DropdownMenuItemIndicator>
                    {{ t.versionsOnlyYours }}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator :class="menuCls.separator" />
                <DropdownMenuCheckboxItem v-model="list.showAutosaves.value" :class="filterItem">
                  <DropdownMenuItemIndicator :class="ui.menuIndicator()">
                    <icon-lucide-check class="size-3.5" />
                  </DropdownMenuItemIndicator>
                  {{ t.showAutosaveVersions }}
                </DropdownMenuCheckboxItem>
              </MenuScrollArea>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
        <IconButton
          v-if="list.canEdit.value"
          :label="t.addToVersionHistory"
          @click="openVersionDialog(shown)"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
        <IconButton :label="t.closeVersionHistory" @click="closeVersionHistory(shown)">
          <icon-lucide-x class="size-3.5" />
        </IconButton>
      </template>
    </PanelHeader>

    <ul
      ref="listElement"
      :class="ui.list()"
      :aria-label="t.versionHistory"
      @scroll="rememberScroll"
    >
      <CloudVersionListItem
        :label="t.currentVersion"
        current
        :selected="selectedId === null"
        :last="list.versions.value.length === 0"
        @select="showCurrentVersion(shown)"
      />
      <CloudVersionListItem
        v-for="(version, index) in list.versions.value"
        :key="version.id"
        :label="titleOf(version)"
        :description="descriptionOf(version)"
        :author="version.createdBy.name"
        :at="version.createdAt"
        :named="list.isNamed(version)"
        :selected="selectedId === version.id"
        :last="index === list.versions.value.length - 1"
        @select="select(version)"
      >
        <template v-if="list.canEdit.value || linkable" #actions>
          <DropdownMenuRoot :modal="false">
            <DropdownMenuTrigger as-child>
              <IconButton :label="t.versionOptions">
                <icon-lucide-ellipsis class="size-3.5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent :class="menuCls.content" align="end" :side-offset="4">
                <MenuScrollArea>
                  <template v-if="list.canEdit.value">
                    <DropdownMenuItem
                      :class="menuCls.item"
                      @select="openVersionDialog(shown, version)"
                    >
                      {{ version.name ? t.editVersionInfo : t.addToVersionHistory }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="!version.current"
                      :class="menuCls.item"
                      @select="restore(version)"
                    >
                      {{ t.restoreVersion }}
                    </DropdownMenuItem>
                    <DropdownMenuItem :class="menuCls.item" @select="duplicate(version)">
                      {{ t.duplicateVersion }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="version.name"
                      :class="menuCls.item"
                      @select="deleteInfo(version)"
                    >
                      {{ t.deleteVersionInfo }}
                    </DropdownMenuItem>
                  </template>
                  <DropdownMenuItem
                    v-if="linkable"
                    :class="menuCls.item"
                    @select="copyLink(version)"
                  >
                    {{ t.shareCopyLink }}
                  </DropdownMenuItem>
                </MenuScrollArea>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </template>
      </CloudVersionListItem>
    </ul>
    <p v-if="list.failed.value" :class="ui.status()" role="alert">{{ t.versionsFailed }}</p>
    <p v-else-if="!list.loading.value && list.versions.value.length === 0" :class="ui.status()">
      {{ t.noVersions }}
    </p>
    <div v-if="list.nextCursor.value" :class="ui.more()">
      <AppButton size="sm" :loading="list.loading.value" @click="list.loadOlder()">
        {{ t.olderVersions }}
      </AppButton>
    </div>
  </section>
</template>
