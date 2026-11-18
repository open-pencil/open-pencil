<script setup lang="ts">
import { DialogClose } from 'reka-ui'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'

/**
 * A dialog's Cancel button: it closes the dialog through its `open` model, says Cancel unless the
 * default slot names it otherwise, and takes AppButton's props such as `size` and `disabled`.
 */
defineOptions({ inheritAttrs: false })
const common = useCommonMessages()
</script>

<template>
  <DialogClose as-child>
    <AppButton v-bind="$attrs"
      ><slot>{{ common.cancel }}</slot></AppButton
    >
  </DialogClose>
</template>
