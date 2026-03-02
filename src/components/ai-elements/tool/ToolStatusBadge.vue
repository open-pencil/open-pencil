<script setup lang="ts">
// Adapted from ai-elements-vue — inline badge (no shadcn-vue dep), lucide-vue-next
import type { DynamicToolUIPart, ToolUIPart } from 'ai'
import type { Component } from 'vue'
import { CheckCircleIcon, CircleIcon, ClockIcon, XCircleIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '../utils'

export type ToolPart = ToolUIPart | DynamicToolUIPart

const props = defineProps<{ state: ToolPart['state'] }>()

const LABELS: Record<ToolPart['state'], string> = {
  'input-streaming':    'Pending',
  'input-available':   'Running',
  'approval-requested': 'Awaiting Approval',
  'approval-responded': 'Responded',
  'output-available':  'Completed',
  'output-error':      'Error',
  'output-denied':     'Denied',
}

const ICONS: Record<ToolPart['state'], Component> = {
  'input-streaming':    CircleIcon,
  'input-available':   ClockIcon,
  'approval-requested': ClockIcon,
  'approval-responded': CheckCircleIcon,
  'output-available':  CheckCircleIcon,
  'output-error':      XCircleIcon,
  'output-denied':     XCircleIcon,
}

const ICON_CLASSES: Record<ToolPart['state'], string> = {
  'input-streaming':    'size-3',
  'input-available':   'size-3 animate-pulse',
  'approval-requested': 'size-3 text-yellow-500',
  'approval-responded': 'size-3 text-blue-400',
  'output-available':  'size-3 text-green-400',
  'output-error':      'size-3 text-red-400',
  'output-denied':     'size-3 text-orange-400',
}

const label = computed(() => LABELS[props.state])
const icon = computed<Component>(() => ICONS[props.state])
const iconClass = computed(() => ICON_CLASSES[props.state])
</script>

<template>
  <span :class="cn('inline-flex items-center gap-1 rounded-full border border-border bg-hover px-1.5 py-px text-[9px] text-muted')">
    <component :is="icon" :class="iconClass" />
    {{ label }}
  </span>
</template>
