<script setup lang="ts">
import { groupBy } from 'es-toolkit'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import { formatStorageBytes } from '@/app/storage/format-bytes'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import saveToTheme from '@/theme/save-to'

import type { SaveDestination, SaveToState } from './types'

const saveTo = tv(saveToTheme)

/**
 * Saving a document from this device to a Cloud workspace or the storage bucket, when there is
 * more than one place to choose from. The saved copy opens in the same tab and syncs from then
 * on; the file on this device is left as it was.
 */
const { destinations, state } = defineProps<{
  destinations: SaveDestination[]
  state: SaveToState
}>()

const open = defineModel<boolean>('open', { default: false })
const name = defineModel<string>('name', { default: '' })
/** The chosen destination's key. */
const destination = defineModel<string>('destination', { default: '' })
const emit = defineEmits<{ save: [] }>()

const ui = saveTo()
const t = useCloudMessages()
const saving = computed(() => state.kind === 'saving')
const progress = computed(() =>
  state.kind === 'saving' && state.totalBytes > 0
    ? Math.round((state.sentBytes / state.totalBytes) * 100)
    : 0
)
/** Destinations by the server they are on; the bucket is a group of its own. */
const groups = computed(() =>
  Object.values(groupBy(destinations, (entry) => entry.place?.id ?? '')).map((entries) => ({
    id: entries[0]?.place?.id ?? '',
    label: entries[0]?.place?.label ?? t.value.saveStorageGroup,
    entries
  }))
)
const chosen = computed(() => destinations.find((entry) => entry.key === destination.value))
const roles = computed(() => ({
  viewer: t.value.viewOnly,
  editor: t.value.roleEditor,
  admin: t.value.roleAdmin
}))
const errors = computed(() => ({
  quota: { heading: t.value.saveQuotaHeading, description: t.value.saveQuotaOwnerDescription },
  offline: { heading: t.value.saveOfflineHeading, description: t.value.saveOfflineDescription },
  unavailable: { heading: t.value.saveFailedHeading, description: t.value.saveFailedDescription }
}))
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="t.saveHeading"
    :description="t.saveDescription"
    @submit="emit('save')"
  >
    <fieldset :class="ui.stack()" :disabled="saving">
      <AppFormField :label="t.saveName">
        <template #default="{ id }">
          <AppInput :id="id" v-model="name" />
        </template>
      </AppFormField>

      <AppFormField :label="t.saveWhere" :label-for="false">
        <template #default="{ labelId }">
          <RadioGroupRoot v-model="destination" :aria-labelledby="labelId" :class="ui.choices()">
            <template v-for="group in groups" :key="group.id">
              <span v-if="groups.length > 1" :class="ui.server()">{{ group.label }}</span>
              <RadioGroupItem
                v-for="entry in group.entries"
                :key="entry.key"
                :value="entry.key"
                :disabled="entry.role === 'viewer'"
                :class="ui.choice()"
              >
                <icon-lucide-layers v-if="entry.kind === 'workspace'" :class="ui.choiceIcon()" />
                <icon-lucide-database v-else :class="ui.choiceIcon()" />
                <span :class="ui.choiceLabel()">{{ entry.label }}</span>
                <span v-if="entry.role" :class="ui.choiceRole()">{{ roles[entry.role] }}</span>
                <span :class="ui.choiceMark()" aria-hidden="true" />
              </RadioGroupItem>
            </template>
          </RadioGroupRoot>
        </template>
      </AppFormField>

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
    <template #footer>
      <AppDialogCancel />
      <AppButton
        type="submit"
        color="primary"
        variant="solid"
        :loading="saving"
        :disabled="!name.trim() || !chosen || chosen.role === 'viewer'"
      >
        {{ t.saveAction }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
