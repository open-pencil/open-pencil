import { shallowRef } from 'vue'

import { openSettingsDialog } from '@/app/settings/dialog'

/** A skill something outside Settings asked to show, such as a reference in the chat. */
export const requestedSkill = shallowRef<string | null>(null)

/** Opens Settings › Skills on the skill with that name, the one the chat would use. */
export function requestSkillSettings(name: string): void {
  requestedSkill.value = name
  openSettingsDialog('skills')
}
