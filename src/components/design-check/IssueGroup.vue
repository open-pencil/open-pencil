<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import SeverityIcon from '@/components/ui/feedback/SeverityIcon.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import Tip from '@/components/ui/overlay/Tip.vue'
import { designCheck } from '@/theme/design-check'

import IssueRow from './IssueRow.vue'
import type { IssueGroupView, IssueRowView } from './types'

/** Rows rendered before a group asks to show the rest. */
const ROW_PAGE_SIZE = 50

const { group } = defineProps<{ group: IssueGroupView }>()
const open = defineModel<boolean>('open', { default: true })
const emit = defineEmits<{
  openRow: [row: IssueRowView]
  hoverRow: [row: IssueRowView | null]
  fix: [row: IssueRowView]
  fixAll: []
  turnOff: []
}>()

const messages = useDesignCheckMessages()
const styles = designCheck()
const menuCls = useMenuUI({ content: 'min-w-40' })
const itemCls = menuItem({ justify: 'start' })
const menuOpen = ref(false)
const limit = ref(ROW_PAGE_SIZE)

const visibleRows = computed(() => group.rows.slice(0, limit.value))
const hiddenCount = computed(() => group.rows.length - visibleRows.value.length)
</script>

<template>
  <AppCollapsible
    v-model:open="open"
    :data-rule-id="group.ruleId"
    :data-menu-open="menuOpen ? '' : undefined"
    :ui="{
      root: styles.group(),
      header: styles.groupHeader(),
      trigger: styles.groupTrigger(),
      icon: styles.chevron(),
      label: styles.groupLabel(),
      actions: styles.groupActions()
    }"
  >
    <template #label>
      <SeverityIcon :severity="group.severity" />
      <Tip :label="group.help ?? undefined" side="left">
        <span :class="styles.groupTitle()">{{ group.title }}</span>
      </Tip>
      <span :class="styles.groupCount()">{{ group.rows.length }}</span>
    </template>
    <template #actions>
      <AppButton v-if="group.fixes.length > 1" color="primary" size="xs" @click="emit('fixAll')">
        {{
          group.bindsOnly
            ? messages.bindAll({ count: group.fixes.length })
            : messages.fixAll({ count: group.fixes.length })
        }}
      </AppButton>
      <DropdownMenuRoot v-model:open="menuOpen" :modal="false">
        <DropdownMenuTrigger as-child>
          <IconButton size="xs" :label="messages.ruleActions">
            <icon-lucide-ellipsis class="size-3.5" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menuCls.content">
            <DropdownMenuItem :class="itemCls" @select="emit('turnOff')">
              <icon-lucide-eye-off class="size-3.5 text-muted" aria-hidden="true" />
              {{ messages.turnOffRule }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </template>

    <ul :class="styles.rows()">
      <IssueRow
        v-for="row in visibleRows"
        :key="row.issue.id"
        :row="row"
        @open="emit('openRow', row)"
        @hover="(hovered) => emit('hoverRow', hovered ? row : null)"
        @fix="emit('fix', row)"
      />
    </ul>
    <AppButton
      v-if="hiddenCount > 0"
      color="primary"
      size="xs"
      :class="styles.more()"
      @click="limit += ROW_PAGE_SIZE * 4"
    >
      {{ messages.showMore({ count: hiddenCount }) }}
    </AppButton>
  </AppCollapsible>
</template>
