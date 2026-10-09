<script setup lang="ts">
import { compact } from 'es-toolkit/array'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed } from 'vue'

import type { PlacedIssueMarker } from '@open-pencil/core/canvas'
import { useDesignCheckMessages } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { issueDetail, ruleTitle } from '@/app/editor/design-check/format'
import { compareIssueSeverity, type DesignIssue } from '@/app/editor/design-check/issues'
import { sceneNodeIcon } from '@/app/editor/icons'
import SeverityIcon from '@/components/ui/feedback/SeverityIcon.vue'
import { issueTooltip } from '@/theme/design-check'

/** Issues listed before the tooltip summarizes the rest. */
const MAX_ITEMS = 4

const { marker, canvas } = defineProps<{
  marker: PlacedIssueMarker | null
  canvas: HTMLElement | null
}>()

const store = useEditorStore()

const messages = useDesignCheckMessages()
const styles = issueTooltip()

const reference = computed(() => {
  const current = marker
  const element = canvas
  if (!current || !element) return null
  return {
    getBoundingClientRect() {
      const bounds = element.getBoundingClientRect()
      const { rect } = current
      return new DOMRect(bounds.left + rect.x, bounds.top + rect.y, rect.width, rect.height)
    }
  }
})

const issues = computed<DesignIssue[]>(() => {
  if (!marker) return []
  const nodeIds = new Set(marker.nodeIds)
  const all = store.designCheck.snapshot.value?.issues ?? []
  return (
    all
      // Suggestions do not earn a marker, so the tooltip lists what the marker counts.
      .filter((issue) => nodeIds.has(issue.nodeId) && issue.severity !== 'info')
      .toSorted(compareIssueSeverity)
  )
})

const singleNode = computed(() =>
  marker?.nodeIds.length === 1 ? store.graph.getNode(marker.nodeIds[0]) : undefined
)

const items = computed(() =>
  issues.value.slice(0, MAX_ITEMS).map((issue) => {
    const detail = issueDetail(issue, messages.value)
    // The header names a single layer, except on an edge pin, where it names the direction.
    const layer =
      singleNode.value && !marker?.direction
        ? null
        : (store.graph.getNode(issue.nodeId)?.name ?? issue.nodeName)
    return {
      id: issue.id,
      severity: issue.severity,
      title: ruleTitle(issue.ruleId, messages.value),
      detail: compact([layer, detail]).join(' · ')
    }
  })
)

const remaining = computed(() => issues.value.length - items.value.length)

type Side = 'top' | 'right' | 'bottom' | 'left'

/** The side an edge pin points to, by its stronger axis; the tooltip opens the other way. */
const edgeSide = computed<Side | null>(() => {
  const direction = marker?.direction
  if (!direction) return null
  if (Math.abs(direction.x) >= Math.abs(direction.y)) return direction.x < 0 ? 'left' : 'right'
  return direction.y < 0 ? 'top' : 'bottom'
})

const OPPOSITE: Record<Side, Side> = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }

const edgeHeading = computed(() => {
  const side = edgeSide.value
  if (!side) return null
  const headings = {
    left: messages.value.edgeLeft,
    right: messages.value.edgeRight,
    top: messages.value.edgeAbove,
    bottom: messages.value.edgeBelow
  }
  return headings[side]
})
</script>

<template>
  <TooltipProvider :delay-duration="0" disable-hoverable-content>
    <TooltipRoot :open="!!marker && items.length > 0">
      <TooltipTrigger v-if="reference" as-child :reference="reference">
        <span class="hidden" />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="edgeSide ? OPPOSITE[edgeSide] : 'right'"
          align="start"
          :side-offset="8"
          :collision-padding="8"
          :class="styles.content()"
          data-test-id="issue-marker-tooltip"
        >
          <div :class="styles.header()">
            <span v-if="edgeHeading" :class="styles.headerText()">{{ edgeHeading }}</span>
            <template v-else-if="singleNode">
              <component
                :is="sceneNodeIcon(singleNode)"
                :class="styles.headerIcon()"
                aria-hidden="true"
              />
              <span :class="styles.headerText()">{{ singleNode.name }}</span>
            </template>
            <span v-else :class="styles.headerText()">
              {{ messages.markerLayers({ count: marker?.nodeIds.length ?? 0 }) }}
            </span>
          </div>
          <div v-for="item in items" :key="item.id" :class="styles.item()">
            <SeverityIcon :severity="item.severity" :class="styles.itemIcon()" />
            <div :class="styles.itemBody()">
              <div :class="styles.itemTitle()">{{ item.title }}</div>
              <div v-if="item.detail" :class="styles.itemDetail()">{{ item.detail }}</div>
            </div>
          </div>
          <div v-if="remaining > 0" :class="styles.more()">
            {{ messages.markerMore({ count: remaining }) }}
          </div>
          <div :class="styles.hint()">
            {{ edgeSide ? messages.edgeHint : messages.markerHint }}
          </div>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
