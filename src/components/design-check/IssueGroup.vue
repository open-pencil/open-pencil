<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import Tip from '@/components/ui/overlay/Tip.vue'
import { designCheck } from '@/theme/design-check'

import IssueRow from './IssueRow.vue'
import SeverityIcon from './SeverityIcon.vue'
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

function showMore() {
  limit.value += ROW_PAGE_SIZE * 4
}
</script>

<template>
  <CollapsibleRoot v-model:open="open" :class="styles.group()" :data-rule-id="group.ruleId">
    <div :class="styles.groupHeader()">
      <Tip as-child :label="group.help ?? undefined" side="left">
        <CollapsibleTrigger :class="styles.groupTrigger()">
          <icon-lucide-chevron-right :class="styles.chevron()" aria-hidden="true" />
          <SeverityIcon :severity="group.severity" />
          <span :class="styles.groupTitle()">{{ group.title }}</span>
          <span :class="styles.groupCount()">{{ group.rows.length }}</span>
        </CollapsibleTrigger>
      </Tip>
      <div :class="styles.groupActions()" :data-pinned="menuOpen ? '' : undefined">
        <button
          v-if="group.fixes.length > 1"
          type="button"
          :class="styles.textAction()"
          @click="emit('fixAll')"
        >
          {{ messages.bindAll({ count: group.fixes.length }) }}
        </button>
        <DropdownMenuRoot v-model:open="menuOpen" :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton size="xs" :label="messages.rules" class="size-6">
              <icon-lucide-ellipsis class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="bottom"
              align="end"
              :side-offset="4"
              :class="menuCls.content"
            >
              <DropdownMenuItem :class="itemCls" @select="emit('turnOff')">
                <icon-lucide-eye-off class="size-3.5 text-muted" aria-hidden="true" />
                {{ messages.turnOffRule }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </div>
    <CollapsibleContent :class="styles.groupBody()">
      <div :class="styles.rows()">
        <IssueRow
          v-for="row in visibleRows"
          :key="row.issue.id"
          :row="row"
          @open="emit('openRow', row)"
          @hover="(hovered) => emit('hoverRow', hovered ? row : null)"
          @fix="emit('fix', row)"
        />
        <button v-if="hiddenCount > 0" type="button" :class="styles.more()" @click="showMore">
          {{ messages.showMore({ count: hiddenCount }) }}
        </button>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
