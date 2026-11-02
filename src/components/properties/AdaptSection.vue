<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  ALL_TOOLS,
  PRINT_PRODUCT_IDS,
  type PrintProductId,
  type ToolDef
} from '@lawha/core/tools'
import { usePrintMessages } from '@lawha/vue/i18n'

import { runEditorTool } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { nodeId } = defineProps<{ nodeId: string }>()

const store = useEditorStore()
const print = usePrintMessages()
const busy = ref(false)
const product = ref<PrintProductId>('business-card-gulf')

/** `business-card-gulf` → `productBusinessCardGulf`, the product's message key. */
function productKey(id: PrintProductId) {
  const camel = id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return `product${camel}` as keyof typeof print.value
}

const productOptions = computed(() =>
  PRINT_PRODUCT_IDS.map((id) => ({ value: id, label: String(print.value[productKey(id)]) }))
)

const SOCIAL_FORMATS = [
  'instagram-post',
  'instagram-story',
  'x-post',
  'linkedin-post',
  'youtube-thumbnail'
]

function toolDef(name: string): ToolDef {
  const def = ALL_TOOLS.find((tool) => tool.name === name)
  if (!def) throw new Error(`Missing tool ${name}`)
  return def
}

/** The layers a tool reports making: a list of copies, or the one sheet it built. */
function createdIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  if ('created' in result && Array.isArray(result.created))
    return result.created.map((item: { id: string }) => item.id)
  if ('id' in result) return [String(result.id)]
  return []
}

/** Runs an editor tool as one undoable step, then selects what it made. */
async function run(name: string, args: Record<string, unknown>) {
  if (busy.value) return
  busy.value = true
  try {
    const result = await runEditorTool({
      store,
      figma: makeFigmaFromStore(store),
      def: toolDef(name),
      args: { id: nodeId, ...args },
      source: print.value.section
    })
    if (result && typeof result === 'object' && 'error' in result)
      throw new Error(String(result.error))
    const created = createdIds(result)
    if (created.length > 0) store.select(created)
    toast.info(print.value.done({ count: created.length }))
  } catch (error) {
    toast.error(
      print.value.failed({ error: error instanceof Error ? error.message : String(error) })
    )
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PanelSection :label="print.section" data-test-id="adapt-section">
    <div class="flex flex-col gap-1.5">
      <AppButton
        variant="outline"
        class="w-full justify-start"
        data-test-id="adapt-to-screens"
        :title="print.toScreensHint"
        :disabled="busy"
        @click="run('resize_for_screens', {})"
      >
        <icon-lucide-monitor-smartphone class="size-3.5" aria-hidden="true" />
        <span class="truncate">{{ print.toScreens }}</span>
      </AppButton>
      <AppButton
        variant="outline"
        class="w-full justify-start"
        data-test-id="adapt-to-social"
        :title="print.toSocialHint"
        :disabled="busy"
        @click="run('resize_for_platforms', { formats: SOCIAL_FORMATS })"
      >
        <icon-lucide-share-2 class="size-3.5" aria-hidden="true" />
        <span class="truncate">{{ print.toSocial }}</span>
      </AppButton>
      <div class="mt-1 flex items-center gap-1.5">
        <AppSelect
          v-model="product"
          :options="productOptions"
          :label="print.product"
          :ui="{ trigger: 'w-auto min-w-0 flex-1' }"
          data-test-id="print-product"
        />
      </div>
      <AppButton
        variant="outline"
        class="w-full justify-start"
        data-test-id="convert-to-dieline"
        :title="print.toDielineHint"
        :disabled="busy"
        @click="run('convert_to_dieline', { product })"
      >
        <icon-lucide-scissors class="size-3.5" aria-hidden="true" />
        <span class="truncate">{{ print.toDieline }}</span>
      </AppButton>
    </div>
  </PanelSection>
</template>
