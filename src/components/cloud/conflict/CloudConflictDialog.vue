<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import { cloudConflict } from '@/theme/cloud/conflict'

import type { ConflictChoice, ConflictVersion } from './types'

/**
 * A Cloud document saved elsewhere while this device held unsent changes. Both versions are kept
 * until the person chooses; the safe choice keeps both, the others say whose work they discard.
 */
const { documentName, mine, cloud } = defineProps<{
  documentName: string
  mine: ConflictVersion
  cloud: ConflictVersion
}>()

const open = defineModel<boolean>('open', { default: false })
const choice = defineModel<ConflictChoice>('choice', { default: 'keep-both' })
const emit = defineEmits<{ confirm: [choice: ConflictChoice]; later: [] }>()

const ui = cloudConflict()
const options = computed(() => [
  {
    value: 'keep-both' as const,
    label: 'Keep both',
    description: `The Cloud version stays as “${documentName}”. Yours is saved next to it as “${documentName} (your copy)”.`
  },
  {
    value: 'use-cloud' as const,
    label: 'Use the Cloud version',
    description: 'Your unsent changes on this device are discarded.'
  },
  {
    value: 'use-mine' as const,
    label: 'Replace it with your version',
    description: cloud.by
      ? `${cloud.by}’s latest changes are replaced for everyone.`
      : 'The newer version on the server is replaced for everyone.'
  }
])
const confirmLabel = computed(
  () =>
    ({
      'keep-both': 'Keep both',
      'use-cloud': 'Use Cloud version',
      'use-mine': 'Replace with mine'
    })[choice.value]
)
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md">
    <AppDialogHeader
      :heading="`“${documentName}” was changed in two places`"
      description="Someone saved a newer version while you had unsent changes. Nothing is lost until you choose."
      close-label="Close"
    />
    <AppDialogBody>
      <div :class="ui.versions()">
        <figure
          v-for="version in [
            { ...mine, label: 'Your version' },
            { ...cloud, label: 'Cloud version' }
          ]"
          :key="version.label"
          :class="ui.version()"
        >
          <span :class="ui.preview()">
            <img v-if="version.previewURL" :src="version.previewURL" alt="" :class="ui.image()" />
            <icon-lucide-file-image v-else class="size-6 text-muted/40" />
          </span>
          <figcaption :class="ui.caption()">
            <span :class="ui.versionLabel()">{{ version.label }}</span>
            <span :class="ui.versionMeta()">
              {{ version.by ? `${version.by} · ${version.savedAgo}` : version.savedAgo }}
            </span>
          </figcaption>
        </figure>
      </div>
      <RadioGroupRoot v-model="choice" aria-label="Which version to keep" :class="ui.options()">
        <RadioGroupItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :class="ui.option()"
          :data-tone="option.value === 'use-mine' ? 'danger' : undefined"
        >
          <span :class="ui.optionMark()" aria-hidden="true" />
          <span class="min-w-0">
            <span :class="ui.optionLabel()">{{ option.label }}</span>
            <span :class="ui.optionDescription()">{{ option.description }}</span>
          </span>
        </RadioGroupItem>
      </RadioGroupRoot>
    </AppDialogBody>
    <AppDialogFooter>
      <AppButton variant="ghost" @click="emit('later')">Decide later</AppButton>
      <AppButton
        :color="choice === 'use-mine' ? 'error' : 'primary'"
        variant="solid"
        @click="emit('confirm', choice)"
      >
        {{ confirmLabel }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
