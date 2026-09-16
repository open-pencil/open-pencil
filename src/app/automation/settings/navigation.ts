import { ref } from 'vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { useSettingsNavigation } from '@/app/settings/navigation/use'

export type AutomationSettingsView = 'tools' | 'connections'

const view = ref<AutomationSettingsView>('tools')

export function openAutomationSettings(next: AutomationSettingsView) {
  view.value = next
  openSettingsDialog('mcp')
}

export function useAutomationSettingsNavigation() {
  const navigation = useSettingsNavigation()
  function selectView(next: string | number) {
    if ((next !== 'tools' && next !== 'connections') || next === view.value) return
    const select = () => {
      view.value = next
    }
    if (navigation) navigation.request(select)
    else select()
  }
  return { view, selectView }
}
