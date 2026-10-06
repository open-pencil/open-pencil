<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import HudButton from '@/components/mobile-hud/HudButton.vue'
import { useMobileHudContext } from '@/components/MobileHud/context'
import AvatarStack from '@/components/presence/AvatarStack.vue'
import PresenceList from '@/components/presence/PresenceList.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { presencePopover } from '@/theme/mobile/presence-popover'

const hud = useMobileHudContext()
const styles = presencePopover()
</script>

<template>
  <PopoverRoot v-if="hud.collabState.inRoom">
    <PopoverTrigger as-child>
      <HudButton :label="hud.peopleLabel" data-test-id="mobile-presence" :class="styles.trigger()">
        <span :class="styles.summary()">
          <span :class="styles.dot()" :data-status="hud.collabState.status" />
          <AvatarStack :people="hud.people" :max="4" />
        </span>
      </HudButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :modal="false"
        :side-offset="8"
        side="bottom"
        align="center"
        :class="styles.content()"
        @open-auto-focus.prevent
      >
        <p class="mb-2 text-xs text-surface" data-test-id="mobile-room-status">
          {{ hud.statusText }}
        </p>
        <PresenceList
          :rows="hud.people"
          :following="hud.following"
          @follow="hud.follow"
          @rename="hud.renameAgent"
        />
        <AppButton variant="outline" class="mt-3 w-full" @click="hud.disconnect">
          {{ hud.messages.disconnect }}
        </AppButton>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
