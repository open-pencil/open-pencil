<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  DIRECTIONS,
  EASINGS,
  TRANSITION_TYPES,
  readFlows,
  readInteractions,
  screenOf,
  screensOf,
  type Action,
  type Interaction,
  type Transition,
  type Trigger
} from '@lawha/core/prototype'
import { ALL_TOOLS, type ToolDef } from '@lawha/core/tools'
import { usePrototypeMessages } from '@lawha/vue/i18n'

import { runEditorTool } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { useEditorStore } from '@/app/editor/active-store'
import { openPlayer } from '@/app/prototype/player'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { nodeId = null } = defineProps<{ nodeId?: string | null }>()

const store = useEditorStore()
const t = usePrototypeMessages()
const busy = ref(false)

const pageId = computed(() => store.state.currentPageId)
// Re-read after every edit: the graph is not reactive, the scene version is.
const version = computed(() => store.state.sceneVersion)

const screens = computed(() => {
  void version.value
  return screensOf(store.graph, pageId.value)
})

const interactions = computed<Interaction[]>(() => {
  void version.value
  const node = nodeId ? store.graph.getNode(nodeId) : null
  return node ? readInteractions(node) : []
})

/** Where Present starts: the selected screen, else the first flow, else the first screen. */
const startScreen = computed(() => {
  void version.value
  if (nodeId) {
    const own = screenOf(store.graph, nodeId, pageId.value)
    if (own) return own.id
  }
  const page = store.graph.getNode(pageId.value)
  return (page ? readFlows(page)[0]?.start : undefined) ?? screens.value[0]?.id ?? null
})

const camel = (s: string) => s.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase())
const label = (prefix: string, value: string) =>
  String(t.value[`${prefix}${camel(value)}` as keyof typeof t.value] ?? value)

const triggerOptions = computed(() =>
  (['click', 'hover', 'press', 'after-delay', 'key'] as const).map((v) => ({
    value: v,
    label: label('trigger', v)
  }))
)
const actionOptions = computed(() =>
  (['navigate', 'back', 'overlay', 'close-overlay', 'open-url'] as const).map((v) => ({
    value: v,
    label: label('action', v)
  }))
)
const transitionOptions = computed(() =>
  TRANSITION_TYPES.map((v) => ({ value: v, label: label('transition', v) }))
)
const directionOptions = computed(() =>
  DIRECTIONS.map((v) => ({ value: v, label: label('direction', v) }))
)
const easingOptions = computed(() => EASINGS.map((v) => ({ value: v, label: label('easing', v) })))
const screenOptions = computed(() => screens.value.map((s) => ({ value: s.id, label: s.name })))

function toolDef(name: string): ToolDef {
  const def = ALL_TOOLS.find((tool) => tool.name === name)
  if (!def) throw new Error(`Missing tool ${name}`)
  return def
}

async function run(name: string, args: Record<string, unknown>) {
  if (busy.value) return null
  busy.value = true
  try {
    const result = await runEditorTool({
      store,
      figma: makeFigmaFromStore(store),
      def: toolDef(name),
      args,
      source: t.value.section
    })
    if (result && typeof result === 'object' && 'error' in result)
      throw new Error(String(result.error))
    return result
  } catch (error) {
    toast.error(t.value.failed({ error: error instanceof Error ? error.message : String(error) }))
    return null
  } finally {
    busy.value = false
  }
}

function save(list: Interaction[]) {
  if (nodeId) void run('set_interactions', { id: nodeId, interactions: list })
}

const DEFAULT_TRANSITION: Transition = {
  type: 'dissolve',
  direction: 'left',
  duration: 300,
  easing: 'ease-out'
}

function nextScreen(): string | null {
  const here = startScreen.value
  const list = screens.value
  const index = list.findIndex((s) => s.id === here)
  return (list[index + 1] ?? list.find((s) => s.id !== here))?.id ?? null
}

function add() {
  const destination = nextScreen()
  const action: Action = destination
    ? { type: 'navigate', destination, transition: DEFAULT_TRANSITION }
    : { type: 'back', transition: DEFAULT_TRANSITION }
  save([...interactions.value, { trigger: { type: 'click' }, action }])
}

function update(index: number, change: (i: Interaction) => Interaction) {
  save(interactions.value.map((item, i) => (i === index ? change(item) : item)))
}

function remove(index: number) {
  save(interactions.value.filter((_, i) => i !== index))
}

function defaultTrigger(type: Trigger['type']): Trigger {
  if (type === 'after-delay') return { type, delay: 1000 }
  if (type === 'key') return { type, key: 'Enter' }
  return { type }
}

function setTrigger(index: number, type: Trigger['type']) {
  update(index, (i) => ({ ...i, trigger: defaultTrigger(type) }))
}

function defaultAction(type: Action['type'], destination: string, transition: Transition): Action {
  switch (type) {
    case 'navigate':
      return { type, destination, transition }
    case 'overlay':
      return { type, destination, position: 'center', closeOnOutside: true, transition }
    case 'back':
      return { type, transition }
    case 'open-url':
      return { type, url: 'https://example.com' }
    case 'scroll-to':
      return { type, destination }
    default:
      return { type: 'close-overlay' }
  }
}

function setAction(index: number, type: Action['type']) {
  const current = interactions.value[index].action
  const kept = ('transition' in current ? current.transition : undefined) ?? DEFAULT_TRANSITION
  const action = defaultAction(type, nextScreen() ?? '', kept)
  update(index, (i) => ({ ...i, action }))
}

function setDestination(index: number, destination: string) {
  update(index, (i) =>
    'destination' in i.action ? { ...i, action: { ...i.action, destination } } : i
  )
}

function setTransition(index: number, change: Partial<Transition>) {
  update(index, (i) =>
    'transition' in i.action && i.action.transition
      ? {
          ...i,
          action: { ...i.action, transition: { ...i.action.transition, ...change } } as Action
        }
      : i
  )
}

function setDelay(index: number, value: string) {
  const delay = Math.max(0, Math.min(60000, Number(value) || 0))
  update(index, (i) => ({ ...i, trigger: { type: 'after-delay', delay } }))
}

function setKey(index: number, key: string) {
  if (key) update(index, (i) => ({ ...i, trigger: { type: 'key', key } }))
}

function setURL(index: number, url: string) {
  update(index, (i) => ({ ...i, action: { type: 'open-url', url } }))
}

async function autoLink() {
  const result = await run('auto_prototype', {})
  if (result && typeof result === 'object' && 'linked' in result)
    toast.info(t.value.autoDone({ count: Number(result.linked) }))
}

function present() {
  if (startScreen.value) openPlayer(pageId.value, startScreen.value)
  else toast.info(t.value.noScreens)
}

const transitionOf = (i: Interaction) =>
  'transition' in i.action ? i.action.transition : undefined
const showsDirection = (tr: Transition | undefined) =>
  !!tr && ['slide-in', 'slide-out', 'push', 'move-in'].includes(tr.type)
</script>

<template>
  <PanelSection :label="t.section" data-test-id="prototype-section">
    <div class="flex flex-col gap-1.5">
      <div class="flex gap-1.5">
        <AppButton
          color="primary"
          variant="solid"
          class="flex-1"
          data-test-id="prototype-present"
          :title="t.presentHint"
          :disabled="busy"
          @click="present"
        >
          <icon-lucide-play class="size-3.5" aria-hidden="true" />
          <span class="truncate">{{ t.present }}</span>
        </AppButton>
      </div>
      <AppButton
        variant="outline"
        class="w-full justify-start"
        data-test-id="prototype-auto"
        :title="t.autoHint"
        :disabled="busy"
        @click="autoLink"
      >
        <icon-lucide-workflow class="size-3.5" aria-hidden="true" />
        <span class="truncate">{{ t.auto }}</span>
      </AppButton>

      <template v-if="nodeId">
        <div class="mt-2 flex items-center justify-between text-[11px] font-semibold text-surface">
          <span>{{ t.interactions }}</span>
          <IconButton :label="t.add" data-test-id="prototype-add" @click="add">
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
        </div>
        <p v-if="interactions.length === 0" class="text-[11px] text-muted">{{ t.none }}</p>
        <div
          v-for="(item, index) in interactions"
          :key="index"
          class="flex flex-col gap-1 rounded border border-border p-1.5"
          data-test-id="prototype-interaction"
        >
          <div class="flex items-center gap-1">
            <AppSelect
              :model-value="item.trigger.type"
              :options="triggerOptions"
              :label="t.trigger"
              :ui="{ trigger: 'w-auto min-w-0 flex-1' }"
              data-test-id="prototype-trigger"
              @update:model-value="setTrigger(index, $event as Trigger['type'])"
            />
            <IconButton :label="t.remove" @click="remove(index)">
              <icon-lucide-minus class="size-3.5" />
            </IconButton>
          </div>
          <input
            v-if="item.trigger.type === 'after-delay'"
            type="number"
            min="0"
            step="100"
            class="h-6 rounded bg-input px-1.5 text-[11px]"
            :aria-label="t.delay"
            :value="item.trigger.delay"
            @change="setDelay(index, ($event.target as HTMLInputElement).value)"
          />
          <input
            v-if="item.trigger.type === 'key'"
            class="h-6 rounded bg-input px-1.5 text-[11px]"
            :aria-label="t.key"
            :value="item.trigger.key"
            @change="setKey(index, ($event.target as HTMLInputElement).value)"
          />
          <AppSelect
            :model-value="item.action.type"
            :options="actionOptions"
            :label="t.action"
            data-test-id="prototype-action"
            @update:model-value="setAction(index, $event as Action['type'])"
          />
          <AppSelect
            v-if="'destination' in item.action"
            :model-value="item.action.destination"
            :options="screenOptions"
            :label="t.destination"
            data-test-id="prototype-destination"
            @update:model-value="setDestination(index, String($event))"
          />
          <input
            v-if="item.action.type === 'open-url'"
            type="url"
            dir="ltr"
            class="h-6 rounded bg-input px-1.5 text-[11px]"
            :aria-label="t.url"
            :value="item.action.url"
            @change="setURL(index, ($event.target as HTMLInputElement).value)"
          />
          <template v-if="transitionOf(item)">
            <AppSelect
              :model-value="transitionOf(item)?.type ?? 'instant'"
              :options="transitionOptions"
              :label="t.transition"
              data-test-id="prototype-transition"
              @update:model-value="setTransition(index, { type: $event as Transition['type'] })"
            />
            <div class="flex gap-1">
              <AppSelect
                v-if="showsDirection(transitionOf(item))"
                :model-value="transitionOf(item)?.direction ?? 'left'"
                :options="directionOptions"
                :label="t.direction"
                :ui="{ trigger: 'w-auto min-w-0 flex-1' }"
                @update:model-value="
                  setTransition(index, { direction: $event as Transition['direction'] })
                "
              />
              <AppSelect
                :model-value="transitionOf(item)?.easing ?? 'ease-out'"
                :options="easingOptions"
                :label="t.easing"
                :ui="{ trigger: 'w-auto min-w-0 flex-1' }"
                @update:model-value="
                  setTransition(index, { easing: $event as Transition['easing'] })
                "
              />
              <input
                type="number"
                min="0"
                max="5000"
                step="50"
                class="h-6 w-16 rounded bg-input px-1.5 text-[11px]"
                :aria-label="t.duration"
                :value="transitionOf(item)?.duration"
                @change="
                  setTransition(index, {
                    duration: Math.max(
                      0,
                      Math.min(5000, Number(($event.target as HTMLInputElement).value) || 0)
                    )
                  })
                "
              />
            </div>
          </template>
        </div>
      </template>
    </div>
  </PanelSection>
</template>
