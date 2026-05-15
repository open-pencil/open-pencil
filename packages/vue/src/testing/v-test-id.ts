import type { Directive } from 'vue'

import type { TestId } from './test-id'

function applyTestId(el: HTMLElement, value?: TestId | null) {
  if (value) el.setAttribute('data-test-id', value)
  else el.removeAttribute('data-test-id')
}

export const vTestId: Directive<HTMLElement, TestId | null | undefined> = {
  mounted(el, binding) {
    applyTestId(el, binding.value)
  },
  updated(el, binding) {
    applyTestId(el, binding.value)
  }
}
