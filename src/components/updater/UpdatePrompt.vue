<script setup lang="ts">
import { mapValues } from 'es-toolkit'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { openExternalLink } from '@/app/shell/ui'
import { updateFailureText } from '@/app/shell/updater/messages'
import { downloadProgressLabel } from '@/app/shell/updater/progress'
import type { UpdaterState } from '@/app/shell/updater/session'
import BrandMark from '@/components/brand/BrandMark.vue'
import ExternalLink from '@/components/links/ExternalLink.vue'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppProgress from '@/components/ui/feedback/AppProgress.vue'
import { releaseNotesURL } from '@/constants'
import { motionStyles } from '@/theme/motion/styles'
import { updatePromptTheme, updateStatusUI } from '@/theme/updater'

const {
  state,
  currentVersion,
  installQuitsApp = false,
  class: className
} = defineProps<{
  state: UpdaterState
  /** The running app's version, shown before the update check knows it. */
  currentVersion: string
  /** Windows installers quit the app, so installing and restarting are one step. */
  installQuitsApp?: boolean
  class?: string
}>()
const emit = defineEmits<{
  install: []
  cancel: []
  restart: []
  retry: []
  dismiss: []
}>()

const { updates: t, common } = useI18n()

const release = computed(() => ('release' in state ? state.release : undefined))
const progress = computed(() => {
  if (state.status === 'installing') return { amount: {}, label: t.value.installing }
  if (state.status !== 'downloading') return null
  const { downloaded, total } = state.progress
  return {
    amount: { value: downloaded, max: total },
    label: downloadProgressLabel(t.value, state.progress)
  }
})
const failure = computed(() =>
  state.status === 'failed' ? updateFailureText(t.value, state.step, state.error) : null
)
const ui = computed(() => {
  const theme = updatePromptTheme()
  return {
    ...mapValues(theme, (slot) => slot()),
    root: theme.root({ class: className }),
    spinner: theme.spinner({ class: motionStyles.spinner })
  }
})

/** Notes links open in the system browser; the window must never navigate away. */
function openNotesLink(event: MouseEvent) {
  if (!(event.target instanceof Element)) return
  const anchor = event.target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement)) return
  event.preventDefault()
  event.stopPropagation()
  void openExternalLink(anchor.href)
}
</script>

<template>
  <div data-slot="update-prompt" :data-status="state.status" :class="ui.root">
    <div v-if="release" :class="ui.main">
      <BrandMark variant="app-icon" decorative :class="ui.icon" />

      <div :class="ui.content">
        <AppAlert v-if="failure" tone="error" :heading="failure" :class="ui.alert" />

        <template v-if="state.status === 'installed'">
          <h1 :class="ui.title">{{ t.installed({ version: release.version }) }}</h1>
          <p :class="ui.subtitle">{{ t.restartToFinish }}</p>
        </template>
        <template v-else>
          <h1 :class="ui.title">{{ t.available({ version: release.version }) }}</h1>
          <p :class="ui.subtitle">{{ t.currentVersion({ version: release.currentVersion }) }}</p>
        </template>

        <div :class="ui.notesHeader">
          <h2 :class="ui.notesLabel">{{ t.whatsNew }}</h2>
          <ExternalLink :href="releaseNotesURL(release.version)" class="text-[11px]">
            {{ t.fullReleaseNotes }}
          </ExternalLink>
        </div>
        <div data-slot="update-notes" :class="ui.notes" @click.capture="openNotesLink">
          <MarkdownContent v-if="release.notes" :content="release.notes" density="comfortable" />
          <p v-else :class="ui.empty">{{ t.noNotes }}</p>
        </div>
      </div>
    </div>

    <AppPlaceholder
      v-else
      role="status"
      size="page"
      label-as="h1"
      :label="state.status === 'up-to-date' ? t.upToDate : t.windowTitle"
      :description="t.currentVersion({ version: currentVersion })"
      :ui="updateStatusUI"
    >
      <template #icon>
        <BrandMark variant="app-icon" decorative class="size-full" />
      </template>
      <template v-if="state.status === 'checking'">
        <icon-lucide-loader-circle :class="ui.spinner" aria-hidden="true" />
        <p>{{ t.checking }}</p>
      </template>
      <AppAlert v-else-if="failure" tone="error" :heading="failure" class="w-full text-start" />
    </AppPlaceholder>

    <footer :class="ui.footer">
      <AppProgress
        v-if="progress"
        :amount="progress.amount"
        :label="progress.label"
        aria-live="polite"
        :class="ui.progress"
      />

      <div :class="ui.actions">
        <AppButton
          v-if="state.status === 'downloading'"
          color="neutral"
          variant="ghost"
          @click="emit('cancel')"
        >
          {{ common.cancel }}
        </AppButton>
        <template v-else-if="state.status !== 'installing'">
          <AppButton color="neutral" variant="ghost" @click="emit('dismiss')">
            {{ release ? t.later : common.close }}
          </AppButton>
          <AppButton
            v-if="state.status === 'failed'"
            color="primary"
            variant="solid"
            @click="emit('retry')"
          >
            {{ t.retry }}
          </AppButton>
          <AppButton
            v-else-if="state.status === 'installed'"
            color="primary"
            variant="solid"
            @click="emit('restart')"
          >
            {{ t.restartNow }}
          </AppButton>
          <AppButton
            v-else-if="state.status === 'available'"
            color="primary"
            variant="solid"
            @click="emit('install')"
          >
            {{ installQuitsApp ? t.installAndRestart : t.install }}
          </AppButton>
        </template>
      </div>
    </footer>
  </div>
</template>
