import type { SnappingPreferences } from '@open-pencil/core/editor'

import { getTabsSnapshot } from '@/app/tabs'

import { syncNativeDesignIssuesMenu, syncNativeSnappingMenu } from './native-menu'
import {
  appPreferences,
  updateDesignCheckPreferences,
  updateSnappingPreferences,
  type DesignCheckPreset
} from './store'

export function setSnappingPreference(
  preference: keyof SnappingPreferences,
  enabled: boolean
): void {
  applySnappingPreferences({ [preference]: enabled })
}

/** Stores snapping changes and pushes them to every open editor and the native menu. */
export function applySnappingPreferences(changes: Partial<SnappingPreferences>): void {
  updateSnappingPreferences(changes)
  const snapping = appPreferences.value.editing.snapping
  for (const tab of getTabsSnapshot()) {
    tab.store.state.snappingPreferences = { ...snapping }
  }
  void syncNativeSnappingMenu(snapping).catch((error: unknown) => {
    console.error('[Settings] Failed to synchronize native snapping preferences:', error)
  })
}

export function setDesignIssuesOnCanvas(showOnCanvas: boolean): void {
  updateDesignCheckPreferences({ showOnCanvas })
  void syncNativeDesignIssuesMenu(showOnCanvas).catch((error: unknown) => {
    console.error('[Settings] Failed to synchronize the native design issues menu:', error)
  })
}

export function setDesignCheckPreset(preset: DesignCheckPreset): void {
  updateDesignCheckPreferences({ preset })
}

export function turnOffDesignCheckRule(ruleId: string): void {
  const disabledRules = new Set(appPreferences.value.designCheck.disabledRules)
  disabledRules.add(ruleId)
  updateDesignCheckPreferences({ disabledRules: [...disabledRules] })
}

export function turnOnDesignCheckRules(): void {
  updateDesignCheckPreferences({ disabledRules: [] })
}
