<script setup lang="ts">
import { PopoverClose, PopoverContent, PopoverPortal, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import type { FontFeature } from '@open-pencil/scene-graph'
import { focusStyles } from '@open-pencil/theme'
import type { MixedValue } from '@open-pencil/vue/controls/node-props'
import {
  numberPositionChanges,
  numberPositionOf,
  numberStyleChanges,
  numberStyleOf,
  type FeatureToggle,
  type FontFeatureSections,
  type NumberPosition,
  type NumberStyle
} from '@open-pencil/vue/controls/typography'
import { useMessages } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import AppButton from '@/components/ui/button/AppButton.vue'
import { useInlineSide } from '@/components/ui/direction/inline-side'
import AppPopoverRoot from '@/components/ui/overlay/AppPopoverRoot.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

/**
 * The OpenType features the font of the selected text offers beyond the panel's own switches,
 * by section as Figma's type details list them, with the font's names for its stylistic sets and
 * character variants.
 */
const { sections, features, enabled } = defineProps<{
  sections: FontFeatureSections | null
  /** The first selected text's features, which the number style and position are read from. */
  features: readonly FontFeature[]
  enabled: (tag: string) => MixedValue<boolean>
}>()
const emit = defineEmits<{
  set: [label: string, changes: Record<string, boolean | null>]
}>()

const typography = useMessages('panels/typography')
const common = useMessages('common')
const startSide = useInlineSide('start')
const { open: popupOpen, portalActive } = useRetainedPopup()
const styles = usePopoverUI({
  content: 'flex max-h-[min(36rem,calc(100vh-2rem))] w-72 max-w-[calc(100vw-1rem)] flex-col',
  header: 'flex items-center gap-1.5 border-b border-border px-3 py-2',
  body: 'flex flex-col gap-3 overflow-y-auto p-3'
})

/** The names of the features the panel names itself, by tag. */
const FEATURE_LABELS = computed<Record<string, string>>(() => ({
  CASE: typography.value.caseSensitiveForms,
  CPSP: typography.value.capitalSpacing,
  FRAC: typography.value.fractions,
  ZERO: typography.value.slashedZero,
  DLIG: typography.value.rareLigatures,
  ORDN: typography.value.ordinals,
  SALT: typography.value.stylisticAlternates,
  SWSH: typography.value.swashes,
  TITL: typography.value.titlingAlternates,
  HLIG: typography.value.historicalLigatures,
  SINF: typography.value.scientificInferiors
}))

function label(feature: FeatureToggle): string {
  if (feature.name) return feature.name
  const known = FEATURE_LABELS.value[feature.tag]
  if (known) return known
  const number = String(Number(feature.tag.slice(2)))
  if (feature.tag.startsWith('SS')) return typography.value.stylisticSet({ number })
  if (feature.tag.startsWith('CV')) return typography.value.characterVariant({ number })
  return feature.tag.toLowerCase()
}

const numberStyleLabels = computed<Record<NumberStyle, string>>(() => ({
  DEFAULT: typography.value.numberStyleDefault,
  PNUM_LNUM: typography.value.proportionalLining,
  TNUM_LNUM: typography.value.tabularLining,
  PNUM_ONUM: typography.value.proportionalOldstyle,
  TNUM_ONUM: typography.value.tabularOldstyle
}))
const positionLabels = computed<Record<NumberPosition, string>>(() => ({
  NORMAL: typography.value.positionNormal,
  SUPS: typography.value.positionSuperscript,
  SUBS: typography.value.positionSubscript
}))

const groups = computed(() => {
  const all = sections
  if (!all) return []
  return [
    { title: typography.value.letterCase, toggles: all.letterCase },
    { title: typography.value.numbers, toggles: all.numbers, numbers: true },
    { title: typography.value.letterforms, toggles: all.letterforms },
    { title: typography.value.stylisticSets, toggles: all.stylisticSets },
    { title: typography.value.characterVariants, toggles: all.characterVariants },
    { title: typography.value.otherFeatures, toggles: all.other }
  ].filter(
    (group) =>
      group.toggles.length > 0 ||
      (group.numbers && (all.numberStyles.length > 0 || all.numberPositions.length > 0))
  )
})
</script>

<template>
  <AppPopoverRoot v-model:open="popupOpen">
    <PopoverTrigger
      data-property="more-font-features"
      :class="[
        'flex w-full cursor-pointer items-center justify-between gap-1.5 rounded text-2xs text-muted hover:text-surface',
        focusStyles.ring
      ]"
    >
      <span>{{ typography.moreFeatures }}</span>
      <icon-lucide-chevron-right data-direction="reading" class="size-3.5" />
    </PopoverTrigger>
    <PopoverPortal v-if="portalActive">
      <PopoverContent
        :side="startSide"
        align="end"
        :side-offset="8"
        :collision-padding="8"
        :aria-label="typography.fontFeatures"
        :class="styles.content"
        data-property="font-features"
      >
        <div :class="styles.header">
          <h3 class="text-xs font-semibold text-surface">
            {{ typography.fontFeatures }}
          </h3>
          <PopoverClose as-child>
            <AppButton :aria-label="common.close" class="ms-auto">
              <icon-lucide-x class="size-3.5" />
            </AppButton>
          </PopoverClose>
        </div>
        <div :class="styles.body">
          <p v-if="groups.length === 0" class="text-2xs text-muted">
            {{ typography.noFontFeatures }}
          </p>
          <section v-for="group in groups" :key="group.title" class="flex flex-col gap-2">
            <h4 class="text-2xs font-semibold text-surface">{{ group.title }}</h4>
            <template v-if="group.numbers && sections">
              <PanelFieldGroup
                v-if="sections.numberStyles.length > 0"
                :label="typography.numberStyle"
              >
                <AppSelect
                  :label="typography.numberStyle"
                  :model-value="numberStyleOf(features)"
                  :options="
                    sections.numberStyles.map((style) => ({
                      value: style,
                      label: numberStyleLabels[style]
                    }))
                  "
                  data-property="number-style"
                  @update:model-value="
                    emit('set', 'Change number style', numberStyleChanges($event as NumberStyle))
                  "
                />
              </PanelFieldGroup>
              <PanelFieldGroup
                v-if="sections.numberPositions.length > 0"
                :label="typography.numberPosition"
              >
                <AppSelect
                  :label="typography.numberPosition"
                  :model-value="numberPositionOf(features)"
                  :options="
                    sections.numberPositions.map((position) => ({
                      value: position,
                      label: positionLabels[position]
                    }))
                  "
                  data-property="number-position"
                  @update:model-value="
                    emit(
                      'set',
                      'Change number position',
                      numberPositionChanges($event as NumberPosition)
                    )
                  "
                />
              </PanelFieldGroup>
            </template>
            <label
              v-for="feature in group.toggles"
              :key="feature.tag"
              class="flex items-center justify-between gap-1.5 text-2xs text-muted"
            >
              <span class="min-w-0">{{ label(feature) }}</span>
              <AppSwitch
                :model-value="enabled(feature.tag) === true"
                :label="label(feature)"
                :data-property="`font-feature-${feature.tag.toLowerCase()}`"
                @update:model-value="
                  emit('set', `Change ${feature.tag} feature`, { [feature.tag]: $event })
                "
              />
            </label>
          </section>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </AppPopoverRoot>
</template>
