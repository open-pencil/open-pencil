<script setup lang="ts">
import { useScriptTag } from '@vueuse/core'
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

const { siteKey } = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ update: [token: string] }>()
const container = useTemplateRef('container')
const widgetId = ref<string>()

type Turnstile = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string
      callback(token: string): void
      'error-callback'(): boolean
      'expired-callback'(): void
    }
  ): string
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const { load } = useScriptTag(
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  () => render(),
  { manual: true }
)

function render(): void {
  if (!container.value || !window.turnstile || widgetId.value) return
  widgetId.value = window.turnstile.render(container.value, {
    sitekey: siteKey,
    callback(token) {
      emit('update', token)
    },
    'error-callback'() {
      emit('update', '')
      return true
    },
    'expired-callback'() {
      emit('update', '')
    }
  })
}

watch(container, (value) => {
  if (value) void load()
})

onBeforeUnmount(() => {
  if (widgetId.value) window.turnstile?.remove(widgetId.value)
})
</script>

<template>
  <div ref="container" data-slot="captcha" class="min-h-16" />
</template>
