<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

import { formatStorageBytes } from '@/app/storage/format-bytes'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { cloudSave } from '@/theme/cloud/save'

import type { CloudSaveDestination, CloudSaveState } from './types'

/**
 * Saving a document from this device to a Cloud workspace. The Cloud copy opens in the same tab
 * and syncs from then on; the file on this device is left as it was.
 */
const { destinations, state } = defineProps<{
  destinations: CloudSaveDestination[]
  state: CloudSaveState
}>()

const open = defineModel<boolean>('open', { default: false })
const name = defineModel<string>('name', { default: '' })
/** `serverId/workspaceId` of the chosen workspace. */
const destination = defineModel<string>('destination', { default: '' })
const emit = defineEmits<{ save: []; cancel: [] }>()

const ui = cloudSave()
const t = useCloudMessages()
const common = useCommonMessages()
const saving = computed(() => state.kind === 'saving')
const progress = computed(() =>
  state.kind === 'saving' && state.totalBytes > 0
    ? Math.round((state.sentBytes / state.totalBytes) * 100)
    : 0
)
const roles = computed(() => ({
  viewer: t.value.viewOnly,
  editor: t.value.roleEditor,
  admin: t.value.roleAdmin
}))
const errors = computed(() => ({
  quota: { heading: t.value.saveQuotaHeading, description: t.value.saveQuotaDescription },
  offline: { heading: t.value.saveOfflineHeading, description: t.value.saveOfflineDescription },
  unavailable: { heading: t.value.saveFailedHeading, description: t.value.saveFailedDescription }
}))
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="t.saveHeading"
      :description="t.saveDescription"
      :close-label="common.close"
    />

    <AppDialogBody>
      <fieldset :class="ui.stack()" :disabled="saving">
        <div :class="ui.field()">
          <label for="cloud-save-name" :class="ui.label()">{{ t.saveName }}</label>
          <AppInput id="cloud-save-name" v-model="name" />
        </div>

        <div :class="ui.field()">
          <span id="cloud-save-destination" :class="ui.label()">{{ t.workspace }}</span>
          <RadioGroupRoot
            v-model="destination"
            aria-labelledby="cloud-save-destination"
            :class="ui.choices()"
          >
            <template v-for="server in destinations" :key="server.serverId">
              <span v-if="destinations.length > 1" :class="ui.server()">{{ server.host }}</span>
              <RadioGroupItem
                v-for="workspace in server.workspaces"
                :key="workspace.id"
                :value="`${server.serverId}/${workspace.id}`"
                :disabled="workspace.role === 'viewer'"
                :class="ui.choice()"
              >
                <icon-lucide-layers :class="ui.choiceIcon()" />
                <span :class="ui.choiceLabel()">{{ workspace.name }}</span>
                <span :class="ui.choiceRole()">{{ roles[workspace.role] }}</span>
                <span :class="ui.choiceMark()" aria-hidden="true" />
              </RadioGroupItem>
            </template>
          </RadioGroupRoot>
        </div>

        <div v-if="state.kind === 'saving'" :class="ui.progress()" role="status">
          <div :class="ui.progressTrack()">
            <div :class="ui.progressBar()" :style="{ width: `${progress}%` }" />
          </div>
          <span :class="ui.progressText()">
            {{
              t.saveUploading({
                sent: formatStorageBytes(state.sentBytes),
                total: formatStorageBytes(state.totalBytes)
              })
            }}
          </span>
        </div>
        <AppAlert
          v-else-if="state.kind === 'error' && state.reason === 'too-large'"
          tone="error"
          :heading="t.saveTooLargeHeading"
          :description="t.saveTooLargeDescription({ limit: formatStorageBytes(state.limitBytes) })"
        />
        <AppAlert
          v-else-if="state.kind === 'error'"
          tone="error"
          :heading="errors[state.reason].heading"
          :description="errors[state.reason].description"
        />
        <p v-else :class="ui.note()">
          {{ t.saveNote }}
        </p>
      </fieldset>
    </AppDialogBody>

    <AppDialogFooter>
      <AppButton variant="ghost" @click="emit('cancel')">{{ common.cancel }}</AppButton>
      <AppButton
        color="primary"
        variant="solid"
        :loading="saving"
        :disabled="!name.trim() || !destination"
        @click="emit('save')"
      >
        {{ t.saveHeading }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
