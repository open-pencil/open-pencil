<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useId } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import noteTheme from '@/theme/campaigns/note'

import CampaignIcon from './CampaignIcon.vue'
import CampaignMarkdown from './CampaignMarkdown.vue'
import type { CampaignView } from './types'

/**
 * A campaign as a note inside a settings tab or the share dialog: its title, Markdown body, its
 * action when it has one, and a dismiss. What the buttons do is the caller's.
 */
const { content, kind } = defineProps<CampaignView>()
const emit = defineEmits<{ dismiss: []; act: [] }>()

const common = useMessages('common')
const ui = tv(noteTheme)()
const headingId = useId()
</script>

<template>
  <aside :class="ui.root()" :aria-labelledby="headingId" data-test-id="campaign-note">
    <CampaignIcon :kind="kind" :class="ui.icon()" />
    <div :class="ui.content()">
      <h4 :id="headingId" :class="ui.title()">{{ content.title }}</h4>
      <CampaignMarkdown v-if="content.body" :content="content.body" :class="ui.body()" />
      <div v-if="content.action" :class="ui.actions()">
        <AppButton size="sm" color="primary" variant="outline" @click="emit('act')">
          {{ content.action.label }}
        </AppButton>
      </div>
    </div>
    <IconButton :label="common.dismiss" :class="ui.dismiss()" @click="emit('dismiss')">
      <icon-lucide-x class="size-3.5" aria-hidden="true" />
    </IconButton>
  </aside>
</template>
