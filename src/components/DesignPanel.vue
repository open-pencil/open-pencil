<script setup lang="ts">
import { computed } from 'vue'

import { getNodeEditCapability } from '@open-pencil/core/editor'
import { readIcon } from '@open-pencil/scene-graph'
import { useI18n, useSelectionState, useEditorCommands } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { COMPONENT_TYPES, sceneNodeIcon } from '@/app/editor/icons'
import { openVariablesDialog } from '@/app/editor/tokens/dialog'
import { openLibraryReview, useLibraryService } from '@/app/libraries'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'

import AppearanceSection from './properties/AppearanceSection.vue'
import BehaviourPanel from './properties/component-properties/behaviour/BehaviourPanel.vue'
import ComponentPropertiesSection from './properties/component-properties/ComponentPropertiesSection.vue'
import ComponentPropertyListSection from './properties/component-properties/ComponentPropertyListSection.vue'
import InstanceUpdateAction from './properties/component-properties/instance-update/InstanceUpdateAction.vue'
import PropertyBindButton from './properties/component-properties/PropertyBindButton.vue'
import PropertyBoundField from './properties/component-properties/PropertyBoundField.vue'
import SlotAuthoringSection from './properties/component-properties/slot/SlotAuthoringSection.vue'
import { usePropertyBinding } from './properties/component-properties/usePropertyBinding'
import VariantAuthoringSection from './properties/component-properties/variant/VariantAuthoringSection.vue'
import ConstraintsSection from './properties/constraints/ConstraintsSection.vue'
import EffectsSection from './properties/EffectsSection.vue'
import ExportSection from './properties/ExportSection.vue'
import FillSection from './properties/FillSection.vue'
import FramePresetSelect from './properties/frame-presets/FramePresetSelect.vue'
import FramePresetsSection from './properties/frame-presets/FramePresetsSection.vue'
import IconSection from './properties/IconSection.vue'
import LayoutGridSection from './properties/layout/guides/LayoutGridSection.vue'
import LayoutSection from './properties/layout/LayoutSection.vue'
import MaskSection from './properties/MaskSection.vue'
import PageSection from './properties/PageSection.vue'
import RetainedPanel from './properties/panel/RetainedPanel.vue'
import PositionSection from './properties/PositionSection.vue'
import SelectionColorsSection from './properties/selection/SelectionColorsSection.vue'
import SelectionLayoutSection from './properties/selection/SelectionLayoutSection.vue'
import SelectionActionsControl from './properties/SelectionActionsControl.vue'
import StrokeSection from './properties/stroke/StrokeSection.vue'
import TypographySection from './properties/TypographySection.vue'
import VariablesSection from './properties/VariablesSection.vue'

const store = useEditorStore()
const libraryService = useLibraryService()
const activeTool = computed(() => store.state.activeTool)
const { selectedNode: node, selectedCount: multiCount } = useSelectionState()
const swapBinding = usePropertyBinding('INSTANCE_SWAP')
const swapLinked = computed(() => !!swapBinding.definition.value)
const showBooleanOperations = computed(() => multiCount.value >= 2)
const { getCommand } = useEditorCommands()
const goToMainComponent = getCommand('selection.goToMainComponent')
const detachInstance = getCommand('selection.detachInstance')
const isComponentType = computed(() => {
  const type = node.value?.type
  return type ? COMPONENT_TYPES.has(type) : false
})
// A library's components are edited in the library, so Add variant has nothing to change here.
const canAddVariant = computed(
  () => !!node.value && getNodeEditCapability(store.graph, node.value.id).editable
)
const selectedIcon = computed(() => (node.value ? sceneNodeIcon(node.value) : undefined))
function openSelectedInstanceReview() {
  const instance = node.value
  if (instance?.type !== 'INSTANCE' || !instance.componentId) return
  const component = store.graph.getNode(instance.componentId)
  const identity = component?.librarySource?.identity
  if (!identity) return
  openLibraryReview({
    libraryId: identity.libraryId,
    assetKey: identity.assetKey,
    instanceIds: [instance.id],
    initialInstanceId: instance.id
  })
}
const supportsLayoutGuides = computed(() => {
  const type = node.value?.type
  return type === 'FRAME' || type === 'COMPONENT' || type === 'COMPONENT_SET' || type === 'INSTANCE'
})
const { panels } = useI18n()
</script>

<template>
  <!-- Frame tool presets replace selection properties, matching Figma. -->
  <div
    v-if="activeTool === 'FRAME'"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <FramePresetsSection />
  </div>

  <!-- Multi-select summary -->
  <div
    v-else-if="multiCount > 1"
    data-test-id="design-panel-multi"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PanelHeader>
      <template #icon>
        <icon-lucide-layers-3 class="size-3.5" aria-hidden="true" />
      </template>
      <span role="heading" aria-level="2">
        {{ panels.selectedCount({ count: String(multiCount) }) }}
      </span>
      <template #actions>
        <SelectionActionsControl :show-boolean-operations="showBooleanOperations" />
      </template>
    </PanelHeader>
    <ComponentPropertiesSection />
    <PositionSection />
    <ConstraintsSection />
    <SelectionLayoutSection />
    <AppearanceSection />
    <TypographySection />
    <FillSection />
    <StrokeSection />
    <EffectsSection />
    <SelectionColorsSection />
    <ExportSection />
  </div>

  <!-- Single selection: retain one paused subtree while frame presets are shown. -->
  <RetainedPanel :active="activeTool !== 'FRAME' && multiCount === 1 && !!node">
    <div
      v-if="node"
      data-test-id="design-panel-single"
      class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
    >
      <PanelHeader :component="isComponentType">
        <template #icon>
          <Tip :label="node.type">
            <span role="img" :aria-label="node.type" class="contents">
              <component :is="selectedIcon" class="size-3.5" />
            </span>
          </Tip>
        </template>
        <span role="heading" aria-level="2" class="min-w-0">
          <!-- A swap linked to a property shows the property in place of the layer, as Figma does. -->
          <PropertyBoundField v-if="swapLinked" field="INSTANCE_SWAP" compact />
          <template v-else>{{ node.name }}</template>
        </span>
        <template #actions>
          <IconButton
            v-if="node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'"
            :label="panels.addVariant"
            data-test-id="add-variant"
            :disabled="!canAddVariant"
            @click="store.addVariant(node.id)"
          >
            <icon-lucide-diamond-plus class="size-3.5" />
          </IconButton>
          <PropertyBindButton v-if="node.type === 'INSTANCE'" field="INSTANCE_SWAP" />
          <InstanceUpdateAction
            v-if="node.type === 'INSTANCE'"
            :node="node"
            :editor="store"
            :service="libraryService"
            @review="openSelectedInstanceReview"
          />
          <SelectionActionsControl />
          <template v-if="node.type === 'INSTANCE'">
            <IconButton
              :label="goToMainComponent.label"
              data-test-id="instance-go-to-main"
              @click="goToMainComponent.run()"
            >
              <icon-lucide-crosshair class="size-3.5" />
            </IconButton>
            <IconButton
              :label="detachInstance.label"
              data-test-id="instance-detach"
              @click="detachInstance.run()"
            >
              <icon-lucide-unlink class="size-3.5" />
            </IconButton>
          </template>
        </template>
      </PanelHeader>

      <ComponentPropertiesSection v-if="node.type === 'INSTANCE'" />
      <VariantAuthoringSection
        v-if="
          node.type === 'COMPONENT_SET' ||
          (node.type === 'COMPONENT' &&
            node.parentId &&
            store.graph.getNode(node.parentId)?.type === 'COMPONENT_SET')
        "
      />

      <ComponentPropertyListSection />
      <SlotAuthoringSection />
      <BehaviourPanel v-if="node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'" />

      <!-- Presets size artboards; an icon is a glyph. -->
      <FramePresetSelect v-if="node.type === 'FRAME' && !readIcon(node)" />

      <IconSection />
      <PositionSection />
      <ConstraintsSection />
      <LayoutSection />
      <AppearanceSection />
      <MaskSection />
      <TypographySection v-if="node.type === 'TEXT'" />
      <FillSection />
      <StrokeSection />
      <LayoutGridSection v-if="supportsLayoutGuides" />
      <EffectsSection />
      <SelectionColorsSection />

      <ExportSection />
    </div>
  </RetainedPanel>

  <div
    v-if="activeTool !== 'FRAME' && multiCount <= 1 && !node"
    data-test-id="design-panel-empty"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PageSection />
    <VariablesSection @open-dialog="openVariablesDialog(store)" />
    <ExportSection />
  </div>
</template>
