<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import { useShadrStore } from '../useShadrStore'

const shadr = useShadrStore()
const showSettings = ref(false)
const urlDraft = ref(shadr.serverUrl.value)
const tokenDraft = ref(shadr.token.value)

onMounted(() => {
  if (shadr.status.value === 'idle') {
    void shadr.checkConnection()
  }
})

function handleSaveCredentials() {
  shadr.saveCredentials(urlDraft.value, tokenDraft.value)
  showSettings.value = false
}
</script>

<template>
  <PanelSection label="Minecraft Backend (Shadr)">
    <template #actions>
      <button
        type="button"
        class="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
        :class="shadr.isOnline.value ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'"
        @click="showSettings = !showSettings"
      >
        <span
          class="size-1.5 rounded-full"
          :class="shadr.isOnline.value ? 'bg-emerald-400' : 'bg-rose-400'"
        />
        {{ shadr.isOnline.value ? 'Online' : 'Offline' }}
        <icon-lucide-settings-2 class="size-3 ml-0.5 opacity-70" />
      </button>
    </template>

    <div v-if="showSettings" class="flex flex-col gap-2 p-2 rounded bg-surface/50 border border-border/40">
      <div class="flex flex-col gap-1">
        <label class="text-[10px] text-muted font-mono uppercase">API URL</label>
        <AppInput v-model="urlDraft" placeholder="http://localhost:8128/api/v1" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[10px] text-muted font-mono uppercase">Bearer Token</label>
        <AppInput v-model="tokenDraft" type="password" placeholder="Токен авторизации" />
      </div>
      <div class="flex items-center justify-between mt-1">
        <AppButton size="xs" variant="ghost" @click="shadr.checkConnection">
          <icon-lucide-refresh-cw class="size-3 mr-1" :class="{ 'animate-spin': shadr.isConnecting.value }" />
          Проверить
        </AppButton>
        <AppButton size="xs" color="primary" variant="solid" @click="handleSaveCredentials">
          Сохранить
        </AppButton>
      </div>
    </div>
  </PanelSection>
</template>
