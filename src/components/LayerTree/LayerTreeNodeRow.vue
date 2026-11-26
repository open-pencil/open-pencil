<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { LayerNode } from '@open-pencil/vue/primitives/LayerTree'

import { useEditorStore } from '@/app/editor/active-store'
import {
  showsLayerIssueMark,
  type LayerIssueMark as LayerIssueMarkData
} from '@/app/editor/design-check/layers'
import LayerIssueMark from '@/components/design-check/LayerIssueMark.vue'
import { COMPONENT_TYPES, nodeIcon } from '@/components/icons'
import layerTreeTheme from '@/theme/layer-tree'

import LayerTreeActions from './LayerTreeActions.vue'
import LayerTreeDisclosure from './LayerTreeDisclosure.vue'
import LayerTreeDropIndicator from './LayerTreeDropIndicator.vue'
import LayerTreeRowShell from './LayerTreeRowShell.vue'
import { layerModeNames } from './mode-names'
import type { LayerTreeChrome, LayerTreeItemActions } from './types'
import { useLayerTreeUI } from './ui'

const { node, level, hasChildren, selected, padLeft, expanded, actions, chrome, issue } =
  defineProps<{
    node: LayerNode
    level: number
    hasChildren: boolean
    selected: boolean
    padLeft: string
    expanded: boolean
    actions: LayerTreeItemActions
    chrome: LayerTreeChrome
    /** Design issues on the layer, or inside it, shown while it is collapsed. */
    issue?: LayerIssueMarkData | null
  }>()

const emit = defineEmits<{
  renameStart: [id: string, name: string]
}>()

const ui = useLayerTreeUI()
const store = useEditorStore()
const modeNames = computed(() => layerModeNames(store.graph, node.modeIds))
const showIssue = computed(() => showsLayerIssueMark(issue, expanded))
const layerTree = tv(layerTreeTheme)
const styles = computed(() =>
  layerTree({
    expanded,
    actionsVisible: node.locked || !node.visible,
    trailingShown: node.locked || !node.visible || showIssue.value,
    selected,
    focused: chrome.focused,
    dragging: chrome.draggingId === node.id,
    visible: node.visible,
    component: COMPONENT_TYPES.has(node.type),
    slot: node.slot,
    childDropTarget:
      chrome.instructionTargetId === node.id && chrome.instruction?.type === 'make-child'
  })
)
</script>

<template>
  <LayerTreeRowShell
    :pad-left="padLeft"
    :content-class="styles.content({ class: ui?.content })"
    data-test-id="layers-item"
    data-slot="row"
    :data-selected="selected || undefined"
    :data-focused="chrome.focused || undefined"
    :data-dragging="chrome.draggingId === node.id || undefined"
    :data-hidden="!node.visible || undefined"
    :data-drop-position="
      chrome.instructionTargetId === node.id && chrome.instruction?.type === 'make-child'
        ? 'child'
        : undefined
    "
    :class="styles.row({ class: ui?.row })"
    @dblclick="emit('renameStart', node.id, node.name)"
  >
    <LayerTreeDisclosure
      :expanded="expanded"
      :label="node.name"
      :ui="{
        disclosure: styles.disclosure({ class: ui?.disclosure }),
        placeholder: styles.disclosurePlaceholder({ class: ui?.disclosurePlaceholder })
      }"
      :visible="hasChildren"
      @toggle="actions.toggleExpand"
    />

    <component :is="nodeIcon(node)" data-slot="icon" :class="styles.icon({ class: ui?.icon })" />
    <span data-slot="label" :class="styles.label({ class: ui?.label })">
      <span class="min-w-0 truncate">{{ node.name }}</span>
      <span
        v-for="name in modeNames"
        :key="name"
        data-slot="variable-mode"
        class="shrink-0 rounded-full border border-current/40 px-1.5 text-3xs leading-3.5"
      >
        {{ name }}
      </span>
    </span>
    <template #end>
      <span data-slot="trailing" :class="styles.trailing({ class: ui?.trailing })">
        <LayerIssueMark v-if="issue && showIssue" :mark="issue" />

        <LayerTreeActions
          :node="node"
          :ui="{
            actions: styles.actions({ class: ui?.actions }),
            action: styles.action({ class: ui?.action }),
            lockIcon: layerTree({ actionActive: node.locked }).actionIcon({
              class: ui?.actionIcon
            }),
            visibilityIcon: layerTree({ actionActive: !node.visible }).actionIcon({
              class: ui?.actionIcon
            })
          }"
          @toggle-lock="actions.toggleLock"
          @toggle-visibility="actions.toggleVisibility"
        />
      </span>
    </template>

    <LayerTreeDropIndicator
      :active="chrome.instructionTargetId === node.id"
      :instruction="chrome.instruction"
      :level="level"
      :indent="chrome.indent"
    />
  </LayerTreeRowShell>
</template>
