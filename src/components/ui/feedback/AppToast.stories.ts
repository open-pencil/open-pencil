import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ToastProvider, ToastViewport } from 'reka-ui'
import { computed, ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'

import AppToast from './AppToast.vue'
import { toastProgressPercent, type ToastProps, type ToastProgress } from './toast'

const meta = {
  title: 'Design System/Toast',
  component: AppToast,
  // A toast only renders inside a provider, and the viewport is where it lands.
  decorators: [
    () => ({
      components: { ToastProvider, ToastViewport },
      template: `
        <ToastProvider swipe-direction="up">
          <story />
          <ToastViewport class="fixed top-2 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-1.5" />
        </ToastProvider>
      `
    })
  ],
  args: {
    message: 'Document exported to Downloads',
    // Static stories must not expire while a reviewer is reading them.
    duration: 0
  },
  render: (args) => ({
    components: { AppToast },
    setup: () => ({ args }),
    template: '<AppToast v-bind="args" />'
  })
} satisfies Meta<ToastProps>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Warning: Story = {
  args: {
    message: 'Storage workspace is offline. Changes are queued locally.',
    variant: 'warning',
    copyable: true,
    copyLabel: 'Copy message',
    copiedLabel: 'Copied',
    closeLabel: 'Close'
  }
}

export const Error: Story = {
  args: {
    message: 'Could not save “shadow Figma kit (Community).fig”.',
    variant: 'error',
    copyable: true,
    copyLabel: 'Copy message',
    copiedLabel: 'Copied',
    closeLabel: 'Close'
  }
}

export const WithAction: Story = {
  args: { message: 'Design file moved to Trash.', actionLabel: 'Undo' }
}

export const RepeatedMessage: Story = {
  args: {
    message: 'Lost connection to the collaboration room',
    variant: 'warning',
    count: 4,
    copyable: true,
    copyLabel: 'Copy message',
    copiedLabel: 'Copied',
    closeLabel: 'Close'
  }
}

export const DownloadProgress: Story = {
  args: {
    message: 'Downloading OpenPencil 0.15.2',
    progress: { value: 10_100_000, max: 24_000_000 },
    progressLabel: '42% · 9.6 MiB of 22.9 MiB'
  }
}

export const DownloadProgressUnknownTotal: Story = {
  args: {
    message: 'Downloading OpenPencil 0.15.2',
    progress: { value: 4_400_000 },
    progressLabel: '4.2 MiB downloaded'
  }
}

export const ProgressLifecycle: Story = {
  render: () => ({
    components: { AppButton, AppToast },
    setup() {
      const TOTAL_BYTES = 24_000_000
      const STEP_BYTES = TOTAL_BYTES / 8
      const AUTO_DISMISS_MS = 3000

      const downloaded = ref(0)
      const totalBytes = ref<number | null>(TOTAL_BYTES)
      const reporting = ref(true)

      const progress = computed<ToastProgress | null>(() => {
        if (!reporting.value) return null
        return totalBytes.value === null
          ? { value: downloaded.value }
          : { value: downloaded.value, max: totalBytes.value }
      })
      const progressLabel = computed(() => {
        const percent = toastProgressPercent(progress.value)
        if (percent === null) return `${formatMiB(downloaded.value)} downloaded`
        return `${percent}% · ${formatMiB(downloaded.value)} of ${formatMiB(totalBytes.value ?? 0)}`
      })
      const duration = computed(() => (progress.value ? 0 : AUTO_DISMISS_MS))

      function formatMiB(bytes: number) {
        return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
      }

      return {
        progress,
        progressLabel,
        duration,
        advance: () => {
          downloaded.value = Math.min(TOTAL_BYTES, downloaded.value + STEP_BYTES)
        },
        reset: () => {
          downloaded.value = 0
          totalBytes.value = TOTAL_BYTES
          reporting.value = true
        },
        useUnknownTotal: () => {
          totalBytes.value = null
        },
        stopReporting: () => {
          reporting.value = false
        }
      }
    },
    template: `
      <div class="mt-24 flex flex-wrap items-center gap-2">
        <AppButton @click="advance">Advance download</AppButton>
        <AppButton @click="reset">Reset</AppButton>
        <AppButton @click="useUnknownTotal">Unknown total</AppButton>
        <AppButton @click="stopReporting">Clear progress</AppButton>
      </div>
      <AppToast
        message="Downloading OpenPencil 0.15.2"
        :progress="progress"
        :progress-label="progressLabel"
        :duration="duration"
      />
    `
  })
}
