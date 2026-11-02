<script setup lang="ts">
import { ref } from 'vue'

import { ALL_TOOLS } from '@lawha/core/tools'
import { useDesignSystemMessages } from '@lawha/vue/i18n'

import { runEditorTool } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/** `page` builds from the whole page; `selection` from the selected layers only. */
const { scope } = defineProps<{ scope: 'page' | 'selection' }>()

const store = useEditorStore()
const t = useDesignSystemMessages()
const busy = ref(false)

interface BuildReport {
  variables: { created: number; updated: number }
  bound: number
  inconsistencies: unknown[]
}

function isReport(value: unknown): value is BuildReport {
  return !!value && typeof value === 'object' && 'variables' in value && 'bound' in value
}

async function build() {
  if (busy.value) return
  const def = ALL_TOOLS.find((tool) => tool.name === 'build_design_system')
  if (!def) return
  busy.value = true
  try {
    const result = await runEditorTool({
      store,
      figma: makeFigmaFromStore(store),
      def,
      args: { scope },
      source: t.value.section
    })
    if (result && typeof result === 'object' && 'error' in result)
      throw new Error(String(result.error))
    if (!isReport(result)) return
    const tokens = result.variables.created + result.variables.updated
    toast.info(t.value.done({ tokens, bound: result.bound }))
    if (result.inconsistencies.length > 0)
      toast.warning(t.value.duplicates({ count: result.inconsistencies.length }))
  } catch (error) {
    toast.error(t.value.failed({ error: error instanceof Error ? error.message : String(error) }))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PanelSection :label="t.section" data-test-id="design-system-section">
    <AppButton
      variant="outline"
      class="w-full justify-start"
      data-test-id="design-system-build"
      :title="t.buildHint"
      :disabled="busy"
      @click="build"
    >
      <icon-lucide-swatch-book class="size-3.5" aria-hidden="true" />
      <span class="truncate">{{ t.build }}</span>
      <span class="ms-auto truncate text-muted">
        {{ scope === 'page' ? t.buildPage : t.buildSelection }}
      </span>
    </AppButton>
  </PanelSection>
</template>
