<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { refAutoReset } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import {
  cloudProviderId,
  isS3ConfigComplete,
  readS3Config,
  s3AccessKeyId,
  s3Bucket,
  s3Endpoint,
  s3SecretAccessKey,
  setS3Credentials
} from '@/app/cloud/credentials'
import { formatCloudBytes } from '@/app/cloud/format-bytes'
import { CLOUD_PROVIDERS, createCloudAdapter } from '@/app/cloud/registry'
import {
  buildCorsConfigurationJson,
  collectCloudCorsOrigins,
  isLikelyCorsOrNetworkError
} from '@/app/cloud/s3/cors'
import type { CloudStorageUsage } from '@/app/cloud/types'
import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'
import SecretInput from '@/components/Settings/SecretInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import ProviderSettingsField from '@/components/chat/ProviderSettings/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/chat/ProviderSettings/ProviderSettingsInput.vue'
import { useDialogUI } from '@/components/ui/dialog'

const { dialogs } = useI18n()
// Stack above the Settings modal (overlay z-40 / content z-50).
const learnMoreDialog = useDialogUI({
  overlay: 'z-[60]',
  content: 'z-[70] flex w-[min(24rem,92vw)] max-h-[min(70vh,28rem)] flex-col overflow-hidden'
})

const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const testError = ref('')
const corsHint = ref(false)
const corsApplied = ref(false)
const corsCopied = refAutoReset(false, 2000)
const learnMoreOpen = ref(false)
const usage = ref<CloudStorageUsage | null>(null)
const usageLoading = ref(false)
const usageError = ref<string | null>(null)

const providerOptions = CLOUD_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))

const canTest = computed(() => isS3ConfigComplete(readS3Config()))

const corsJson = computed(() => buildCorsConfigurationJson(collectCloudCorsOrigins()))

const usageSummary = computed(() => {
  if (!usage.value) return null
  const d = dialogs.value
  const { bytesUsed, canvasCount, objectCount } = usage.value
  const size = formatCloudBytes(bytesUsed)
  const files =
    canvasCount === 1 ? d.cloudUsageOneCanvas : `${canvasCount} ${d.cloudUsageCanvasesLabel}`
  return `${size} · ${files} · ${objectCount} ${d.cloudUsageObjectsLabel}`
})

async function refreshUsage() {
  if (!canTest.value) {
    usage.value = null
    usageError.value = null
    return
  }
  usageLoading.value = true
  usageError.value = null
  try {
    const adapter = createCloudAdapter(cloudProviderId.value, readS3Config())
    usage.value = await adapter.getStorageUsage()
  } catch (e) {
    usage.value = null
    usageError.value = e instanceof Error ? e.message : String(e)
  } finally {
    usageLoading.value = false
  }
}

onMounted(() => {
  void refreshUsage()
})

function saveCloud() {
  // Values are bound live to storage refs; keep for Done/dismiss compatibility.
  setS3Credentials(readS3Config())
  testStatus.value = 'idle'
  testError.value = ''
  corsHint.value = false
  corsApplied.value = false
}

async function copyCorsJson() {
  try {
    await navigator.clipboard.writeText(corsJson.value)
    corsCopied.value = true
    toast.info(dialogs.value.cloudCorsCopied)
  } catch (e) {
    console.warn('[Cloud] copy CORS JSON failed:', e)
    toast.error(dialogs.value.cloudCorsCopyFailed)
  }
}

async function testConnection() {
  if (!canTest.value || testStatus.value === 'testing') return
  testStatus.value = 'testing'
  testError.value = ''
  corsHint.value = false
  corsApplied.value = false
  try {
    setS3Credentials(readS3Config())
    const adapter = createCloudAdapter(cloudProviderId.value, readS3Config())
    const result = await adapter.testConnection()
    corsApplied.value = result.corsApplied

    if (result.ok) {
      // Storage works — CORS is fine for this browser (or desktop). Never show the
      // "CORS issue" alert on success; PutBucketCors may fail while ops still work.
      // Result renders inline next to the Test button — no toast.
      testStatus.value = 'success'
      testError.value = ''
      corsHint.value = false
      corsApplied.value = result.corsApplied
      void refreshUsage()
      return
    }

    testStatus.value = 'error'
    testError.value = result.message
    // Only when list/namespace failed with a CORS/network block.
    corsHint.value = result.isCorsFailure
  } catch (error) {
    testStatus.value = 'error'
    testError.value = error instanceof Error ? error.message : String(error)
    corsHint.value = !isTauri() && isLikelyCorsOrNetworkError(error)
  }
}

defineExpose({ saveCloud })
</script>

<template>
  <div class="flex flex-col gap-2" data-test-id="cloud-storage-section">
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-[11px] font-semibold text-surface">{{ dialogs.cloudStorage }}</h4>
      <button
        type="button"
        class="text-[10px] text-muted hover:text-surface"
        data-test-id="cloud-storage-learn-more"
        @click="learnMoreOpen = true"
      >
        {{ dialogs.learnMore }}
      </button>
    </div>

    <DialogRoot v-model:open="learnMoreOpen">
      <DialogPortal>
        <DialogOverlay :class="learnMoreDialog.overlay" />
        <DialogContent
          :class="learnMoreDialog.content"
          data-test-id="cloud-storage-learn-more-dialog"
        >
          <header
            class="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3"
          >
            <div class="min-w-0">
              <DialogTitle :class="learnMoreDialog.title">{{ dialogs.cloudStorage }}</DialogTitle>
              <DialogDescription :class="learnMoreDialog.description" class="mt-0.5">
                {{ dialogs.learnMore }}
              </DialogDescription>
            </div>
            <DialogClose as-child>
              <button
                type="button"
                class="rounded p-1 text-muted hover:bg-hover hover:text-surface"
                data-test-id="cloud-storage-learn-more-close"
                :aria-label="dialogs.close"
              >
                <icon-lucide-x class="size-4" />
              </button>
            </DialogClose>
          </header>
          <div
            class="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-muted"
          >
            <p>{{ dialogs.cloudStorageHint }}</p>
            <p>{{ dialogs.cloudCorsHint }}</p>
          </div>
          <footer
            class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3"
          >
            <button
              type="button"
              class="rounded border border-border px-3 py-1.5 text-[11px] font-medium text-surface hover:bg-hover"
              data-test-id="cloud-storage-learn-more-copy-cors"
              @click="copyCorsJson"
            >
              {{ corsCopied ? dialogs.cloudCorsCopied : dialogs.cloudCopyCorsJson }}
            </button>
            <DialogClose as-child>
              <button
                type="button"
                class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
                data-test-id="cloud-storage-learn-more-done"
              >
                {{ dialogs.done }}
              </button>
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <ProviderSettingsField :label="dialogs.cloudProvider">
      <AppSelect
        v-model="cloudProviderId"
        :options="providerOptions"
        data-test-id="cloud-storage-provider"
      />
    </ProviderSettingsField>

    <ProviderSettingsField :label="dialogs.s3Endpoint">
      <ProviderSettingsInput
        v-model="s3Endpoint"
        type="text"
        data-test-id="cloud-storage-endpoint"
        :placeholder="'https://s3.eu-central-003.backblazeb2.com'"
        @change="saveCloud"
      />
    </ProviderSettingsField>

    <ProviderSettingsField :label="dialogs.s3Bucket">
      <ProviderSettingsInput
        v-model="s3Bucket"
        type="text"
        data-test-id="cloud-storage-bucket"
        :placeholder="dialogs.s3BucketPlaceholder"
        @change="saveCloud"
      />
    </ProviderSettingsField>

    <ProviderSettingsField :label="dialogs.s3AccessKeyId">
      <SecretInput
        v-model="s3AccessKeyId"
        data-test-id="cloud-storage-access-key"
        :placeholder="dialogs.s3AccessKeyPlaceholder"
        @change="saveCloud"
      />
    </ProviderSettingsField>

    <ProviderSettingsField :label="dialogs.s3SecretAccessKey">
      <SecretInput
        v-model="s3SecretAccessKey"
        data-test-id="cloud-storage-secret-key"
        :placeholder="dialogs.s3SecretPlaceholder"
        @change="saveCloud"
      />
    </ProviderSettingsField>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rounded border border-border px-2 py-1 text-[11px] font-medium text-surface hover:bg-hover disabled:opacity-50"
        data-test-id="cloud-storage-test"
        :disabled="!canTest || testStatus === 'testing'"
        @click="testConnection"
      >
        {{ testStatus === 'testing' ? dialogs.testingConnection : dialogs.cloudTestAndApplyCors }}
      </button>
      <p
        v-if="testStatus === 'success'"
        class="text-[10px] text-emerald-500"
        data-test-id="cloud-storage-test-success"
      >
        {{ corsApplied ? dialogs.cloudConnectionSuccessWithCors : dialogs.cloudConnectionSuccess }}
      </p>
      <p
        v-else-if="testStatus === 'error'"
        class="text-[10px] text-red-500"
        data-test-id="cloud-storage-test-error"
      >
        {{ testError || dialogs.cloudConnectionFailed }}
      </p>
    </div>

    <div
      v-if="canTest"
      class="rounded-md border border-border bg-input/30 px-2.5 py-2"
      data-test-id="cloud-storage-usage"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-[11px] font-medium text-surface">{{ dialogs.cloudUsageTitle }}</p>
        <button
          type="button"
          class="text-[10px] text-muted hover:text-surface disabled:opacity-50"
          data-test-id="cloud-storage-usage-refresh"
          :disabled="usageLoading"
          @click="refreshUsage"
        >
          {{ usageLoading ? dialogs.cloudUsageLoading : dialogs.refresh }}
        </button>
      </div>
      <p
        v-if="usageSummary"
        class="mt-1 text-[11px] text-muted"
        data-test-id="cloud-storage-usage-summary"
      >
        {{ usageSummary }}
      </p>
      <p v-else-if="usageLoading" class="mt-1 text-[11px] text-muted">
        {{ dialogs.cloudUsageLoading }}
      </p>
      <p v-else-if="usageError" class="mt-1 text-[11px] text-red-400">
        {{ usageError }}
      </p>
      <p v-else class="mt-1 text-[11px] text-muted">{{ dialogs.cloudUsageEmpty }}</p>
      <p class="mt-1.5 text-[10px] leading-snug text-muted/80">{{ dialogs.cloudUsageHint }}</p>
    </div>

    <div
      v-if="corsHint"
      class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[10px] leading-snug text-amber-600 dark:text-amber-400"
      data-test-id="cloud-storage-cors-alert"
    >
      <p class="font-semibold">{{ dialogs.cloudCorsAlertTitle }}</p>
      <p class="mt-1">{{ dialogs.cloudCorsBrowserHelp }}</p>
      <button
        type="button"
        class="mt-2 rounded border border-border bg-panel px-2 py-0.5 text-[10px] font-medium text-surface hover:bg-hover"
        data-test-id="cloud-storage-cors-alert-copy"
        @click="copyCorsJson"
      >
        {{ dialogs.cloudCopyCorsJson }}
      </button>
    </div>
  </div>
</template>
