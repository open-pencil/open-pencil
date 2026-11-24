<script setup lang="ts">
import { compact } from 'es-toolkit/array'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  type AcceptableValue
} from 'reka-ui'
import { computed } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import type { AgentChoiceCategory } from '@/app/ai/agents/acp/options'
import {
  chatAgentChoices,
  chatAgentDefaults,
  chatAgentOptions,
  chooseAgentOption
} from '@/app/ai/chat/thinking'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

import { chatAgentTheme, chatProfileTheme } from '../ui'
import { useDesignProfiles } from './useDesignProfiles'

/**
 * The Design agent and how hard it thinks: one control by Send, as model pickers keep the
 * thinking level beside the model. Its menu lists the profiles, then the agent's thinking levels
 * and, where the agent keeps them apart from its modes, what it may do without asking.
 */
const { access = null } = defineProps<{ access?: AgentChoiceCategory | null }>()

const ai = useMessages('ai')
const ui = chatAgentTheme()
const profile = chatProfileTheme()
const menuCls = useMenuUI({ content: 'w-64 max-w-[calc(100vw-1rem)]' })
const itemCls = menuItem({ justify: 'start', class: 'relative ps-7' })
const subTriggerCls = [menuCls.subTrigger, 'data-[highlighted]:bg-hover']

const { profiles, selectedProfileId, profileOf, manageModels } = useDesignProfiles()
const profileName = computed(() => profileOf(selectedProfileId.value ?? '')?.label ?? '')

/** One of the agent's options as the menu shows it: its values and the one the chat runs on. */
function option(category: AgentChoiceCategory | null) {
  if (!category) return null
  const offered = chatAgentOptions.value?.[category]
  if (!offered || offered.values.length === 0) return null
  const current = chatAgentChoices.value[category] || offered.current
  const label = offered.values.find((value) => value.id === current)?.name ?? current
  return { category, values: offered.values, current, label }
}
const effort = computed(() => option('thought_level'))
const accessOption = computed(() => option(access))
/**
 * The level shows beside the name once it differs from the agent's own, which some agents call
 * just "Default"; with the agent's own, the name says enough.
 */
const shownLevel = computed(() => {
  const level = effort.value
  if (!level) return null
  const own = chatAgentDefaults.value.thought_level
  return own !== undefined && level.current === own ? null : level.label
})

const triggerLabel = computed(() =>
  compact([
    profileName.value,
    effort.value && `${ai.value.thinkingLevel}: ${effort.value.label}`
  ]).join(', ')
)

function chooseProfile(value: AcceptableValue): void {
  const chosen = profiles.value.find((entry) => entry.value === value)
  if (chosen) selectedProfileId.value = chosen.value
}
</script>

<template>
  <AppDropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        :class="ui.modelControl()"
        :aria-label="triggerLabel"
        data-test-id="chat-agent-model"
      >
        <icon-lucide-bot :class="ui.modelIcon({ levelless: !shownLevel })" aria-hidden="true" />
        <span :class="ui.model({ levelless: !shownLevel })">{{ profileName }}</span>
        <span v-if="shownLevel" :class="ui.level()">{{ shownLevel }}</span>
        <icon-lucide-chevron-down :class="ui.chevron()" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent :class="menuCls.content" align="end" side="top" :side-offset="6">
        <MenuScrollArea>
          <DropdownMenuLabel :class="menuCls.label">{{ ai.modelRoleDesign }}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            :model-value="selectedProfileId ?? ''"
            @update:model-value="chooseProfile"
          >
            <DropdownMenuRadioItem
              v-for="entry in profiles"
              :key="entry.value"
              :value="entry.value"
              :class="itemCls"
            >
              <DropdownMenuItemIndicator :class="[ui.menuIndicator(), 'absolute inset-s-2']">
                <icon-lucide-check class="size-3" />
              </DropdownMenuItemIndicator>
              <span :class="profile.text()">
                <span :class="profile.name()">{{ entry.label }}</span>
                <span :class="profile.metadata()">{{ entry.metadata }}</span>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <template v-for="sub in [effort, accessOption]" :key="sub?.category">
            <template v-if="sub">
              <DropdownMenuSeparator v-if="sub === effort" :class="menuCls.separator" />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  :class="subTriggerCls"
                  :data-test-id="`chat-agent-${sub.category}`"
                >
                  {{ sub === effort ? ai.thinkingLevel : ai.agentAccess }}
                  <span :class="ui.menuValue()">{{ sub.label }}</span>
                  <icon-lucide-chevron-right data-direction="reading" :class="menuCls.icon" />
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent :side-offset="4" :class="menuCls.content">
                    <MenuScrollArea>
                      <DropdownMenuRadioGroup
                        :model-value="sub.current"
                        @update:model-value="
                          (value) => chooseAgentOption(sub.category, String(value))
                        "
                      >
                        <DropdownMenuRadioItem
                          v-for="value in sub.values"
                          :key="value.id"
                          :value="value.id"
                          :class="itemCls"
                        >
                          <DropdownMenuItemIndicator
                            :class="[ui.menuIndicator(), 'absolute inset-s-2']"
                          >
                            <icon-lucide-check class="size-3" />
                          </DropdownMenuItemIndicator>
                          <span :class="profile.text()">
                            <span :class="profile.name()">{{ value.name }}</span>
                            <span v-if="value.description" :class="ui.description()">
                              {{ value.description }}
                            </span>
                          </span>
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </MenuScrollArea>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </template>
          </template>

          <DropdownMenuSeparator :class="menuCls.separator" />
          <DropdownMenuItem :class="[itemCls, 'text-muted']" @select="manageModels()">
            <icon-lucide-settings :class="[menuCls.icon, 'absolute inset-s-2']" />
            {{ ai.manageModelsAndRoles }}
          </DropdownMenuItem>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </AppDropdownMenuRoot>
</template>
