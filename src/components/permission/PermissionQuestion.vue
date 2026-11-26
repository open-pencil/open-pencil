<script setup lang="ts">
import { tv } from 'tailwind-variants'
import * as v from 'valibot'
import { computed } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'
import { acpPermissionOptionTestId, vTestId } from '@open-pencil/vue/testing'

import { ALLOW_MODE, type PermissionQuestion } from '@/app/shell/permission/questions'
import BrandMark from '@/components/brand/BrandMark.vue'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import permissionStyles from '@/theme/permission'

const { question, waiting = 0 } = defineProps<{
  question: PermissionQuestion
  /** How many more questions wait behind this one. */
  waiting?: number
}>()

const emit = defineEmits<{
  /** One of the question's options, or null to refuse it. */
  answer: [option: string | null]
}>()

const ui = tv(permissionStyles)()
const ai = useMessages('ai')

const toolCall = computed(() => (question.kind === 'tool' ? question.params.toolCall : null))
const toolName = computed(() => toolCall.value?.title || ai.value.unknownTool)

/** A plan the agent asks to carry out, as Claude Code's leaves Plan mode with, shown as Markdown. */
const planInputSchema = v.object({ plan: v.pipe(v.string(), v.nonEmpty()) })
const plan = computed(() => {
  const input = v.safeParse(planInputSchema, toolCall.value?.rawInput)
  return input.success ? input.output.plan : null
})

const toolInput = computed(() => {
  const raw = toolCall.value?.rawInput
  if (!raw || plan.value) return null
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
})

const options = computed(() => (question.kind === 'tool' ? question.params.options : []))
const allowOptions = computed(() => options.value.filter((o) => o.kind.startsWith('allow')))
const rejectOptions = computed(() => options.value.filter((o) => o.kind.startsWith('reject')))
</script>

<template>
  <div data-slot="permission-question" :data-kind="question.kind" :class="ui.root()">
    <div :class="ui.main()">
      <BrandMark variant="app-icon" decorative :class="ui.icon()" />
      <div :class="ui.content()">
        <template v-if="question.kind === 'tool'">
          <h1 :class="ui.title()">{{ ai.permissionRequestTitle }}</h1>
          <p :class="ui.subtitle()">
            {{ ai.permissionToolRequest({ agent: question.agent, tool: toolName }) }}
          </p>
          <div v-if="plan || toolInput" :class="ui.detail()">
            <MarkdownContent v-if="plan" :content="plan" density="compact" :class="ui.plan()" />
            <pre v-else :class="ui.input()">{{ toolInput }}</pre>
          </div>
        </template>
        <template v-else>
          <h1 :class="ui.title()">{{ ai.permissionModeTitle }}</h1>
          <p :class="ui.subtitle()">
            {{ ai.permissionModeRequest({ agent: question.agent, mode: question.mode }) }}
          </p>
        </template>
      </div>
    </div>

    <!-- The agent's first allowing answer leads; its others and the refusal stay quieter. -->
    <footer :class="ui.footer()">
      <template v-if="question.kind === 'tool'">
        <AppButton
          v-for="(option, index) in allowOptions"
          :key="option.optionId"
          v-test-id="acpPermissionOptionTestId(option.kind)"
          :color="index === 0 ? 'primary' : 'neutral'"
          :variant="index === 0 ? 'solid' : 'outline'"
          size="md"
          class="h-auto min-h-8 w-full py-1.5 whitespace-normal text-center"
          @click="emit('answer', option.optionId)"
        >
          {{ option.name }}
        </AppButton>
        <AppButton
          v-for="option in rejectOptions"
          :key="option.optionId"
          v-test-id="acpPermissionOptionTestId(option.kind)"
          size="md"
          class="h-auto min-h-8 w-full py-1.5 whitespace-normal"
          @click="emit('answer', option.optionId)"
        >
          {{ option.name }}
        </AppButton>
      </template>
      <template v-else>
        <AppButton
          color="primary"
          variant="solid"
          size="md"
          class="w-full"
          @click="emit('answer', ALLOW_MODE)"
        >
          {{ ai.permissionModeAllow }}
        </AppButton>
        <AppButton size="md" class="w-full" @click="emit('answer', null)">
          {{ ai.permissionModeKeep }}
        </AppButton>
      </template>
      <p v-if="waiting > 0" :class="ui.waiting()">
        {{ ai.permissionMoreWaiting({ count: String(waiting) }) }}
      </p>
    </footer>
  </div>
</template>
