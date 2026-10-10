<script setup lang="ts">
import { useId } from 'vue'
import IconMail from '~icons/lucide/mail'

import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

import { useLandingMessages } from '../content/messages'
import ActionButton from '../ui/ActionButton.vue'
import { useWaitlistForm } from './useWaitlistForm'

/** The OpenPencil Cloud waitlist: one email field, sized and styled like the page's actions. */
const messages = useLandingMessages()
const { email, status, submitting, edit, submit } = useWaitlistForm()
const noteId = useId()
</script>

<template>
  <AppAlert
    v-if="status === 'joined'"
    class="waitlist-result"
    tone="success"
    :heading="messages.waitlist.joined"
    :description="messages.waitlist.joinedDetail"
  />
  <form v-else class="waitlist" novalidate @submit.prevent="submit">
    <div class="fields">
      <AppInput
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        required
        :aria-label="messages.waitlist.label"
        :aria-describedby="noteId"
        :aria-invalid="status === 'invalid' || undefined"
        :placeholder="messages.waitlist.placeholder"
        :state="status === 'invalid' ? 'invalid' : 'idle'"
        :disabled="submitting"
        class="h-10 w-72 max-w-full rounded-full px-4 text-sm"
        @update:model-value="edit"
      />
      <ActionButton :icon="IconMail" primary :disabled="submitting">
        {{ messages.waitlist.submit }}
      </ActionButton>
    </div>
    <p :id="noteId" class="note" :role="status === 'invalid' ? 'alert' : undefined">
      <span v-if="status === 'invalid'" class="invalid">{{ messages.waitlist.invalid }}</span>
      <template v-else>{{ messages.waitlist.privacy }}</template>
    </p>
    <AppAlert
      v-if="status === 'failed'"
      class="waitlist-result"
      tone="error"
      :heading="messages.waitlist.failed"
      :description="messages.waitlist.failedDetail"
    />
  </form>
</template>

<style scoped>
.fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.note {
  margin: 8px 0 0 16px;
  color: var(--vp-c-text-3);
  font-size: 13px;
  line-height: 20px;
}

.invalid {
  color: var(--vp-c-danger-1);
}

.waitlist-result {
  max-width: 420px;
  margin-top: 12px;
}

@media (max-width: 480px) {
  .fields > * {
    width: 100%;
    justify-content: center;
  }
}
</style>
