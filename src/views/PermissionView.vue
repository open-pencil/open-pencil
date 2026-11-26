<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed } from 'vue'

import { useLocale, useMessages } from '@open-pencil/vue/i18n'

import { animationsEnabled } from '@/app/shell/motion'
import { usePermissionQuestions } from '@/app/shell/permission/questions'
import { useAppTheme } from '@/app/shell/theme'
import PermissionQuestion from '@/components/permission/PermissionQuestion.vue'

const ai = useMessages('ai')
const { locale } = useLocale()

useHead({
  title: () => ai.value.permissionRequestTitle,
  htmlAttrs: {
    lang: locale,
    'data-motion': computed(() => (animationsEnabled.value ? 'full' : 'off'))
  }
})
useAppTheme()

const { questions, answer } = usePermissionQuestions()
const current = computed(() => questions.value[0] ?? null)

function answerCurrent(option: string | null) {
  if (current.value) void answer(current.value.id, option)
}
</script>

<template>
  <PermissionQuestion
    v-if="current"
    :key="current.id"
    class="h-dvh"
    :question="current"
    :waiting="questions.length - 1"
    @answer="answerCurrent"
  />
</template>
