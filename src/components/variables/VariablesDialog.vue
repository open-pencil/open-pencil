<script setup lang="ts">
import { DialogTitle } from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { createTokenCopy } from '@/app/editor/tokens/copy'
import { AppDialogClose, AppDialogRoot } from '@/components/ui/dialog'
import TokensPanel from '@/components/variables/TokensPanel.vue'

const open = defineModel<boolean>('open', { default: false })

const { variables, common } = useI18n()
const copyTokens = createTokenCopy(useEditorStore())
</script>

<template>
  <AppDialogRoot
    v-model:open="open"
    size="xl"
    height="full"
    data-test-id="variables-dialog"
    :aria-describedby="undefined"
  >
    <DialogTitle class="sr-only">{{ variables.localVariables }}</DialogTitle>
    <TokensPanel @copy="copyTokens">
      <template #actions>
        <AppDialogClose :ariaLabel="common.close" />
      </template>
    </TokensPanel>
  </AppDialogRoot>
</template>
