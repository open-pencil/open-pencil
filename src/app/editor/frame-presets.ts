import type { Component } from 'vue'
import IconMonitor from '~icons/lucide/monitor'
import IconSmartphone from '~icons/lucide/smartphone'
import IconTablet from '~icons/lucide/tablet'
import IconWatch from '~icons/lucide/watch'

export type FramePresetLabelKey =
  | 'framePresetDesktop'
  | 'framePresetDesktopLarge'
  | 'framePresetMacBookAir'
  | 'framePresetIPadMini'
  | 'framePresetIPadPro11'
  | 'framePresetSurfacePro7'
  | 'framePresetIPhone16Pro'
  | 'framePresetIPhoneSE'
  | 'framePresetAndroidLarge'
  | 'framePresetAppleWatch45'
  | 'framePresetAppleWatch41'

export type FramePresetCategoryLabelKey =
  | 'framePresetCategoryDesktop'
  | 'framePresetCategoryTablet'
  | 'framePresetCategoryPhone'
  | 'framePresetCategoryWatch'

export interface FramePreset {
  id: string
  labelKey: FramePresetLabelKey
  width: number
  height: number
}

export interface FramePresetCategory {
  key: string
  labelKey: FramePresetCategoryLabelKey
  icon: Component
  presets: FramePreset[]
}

export const FRAME_PRESET_CATEGORIES: FramePresetCategory[] = [
  {
    key: 'desktop',
    labelKey: 'framePresetCategoryDesktop',
    icon: IconMonitor,
    presets: [
      { id: 'desktop', labelKey: 'framePresetDesktop', width: 1440, height: 1024 },
      { id: 'desktop-large', labelKey: 'framePresetDesktopLarge', width: 1920, height: 1080 },
      { id: 'macbook-air', labelKey: 'framePresetMacBookAir', width: 1280, height: 832 }
    ]
  },
  {
    key: 'tablet',
    labelKey: 'framePresetCategoryTablet',
    icon: IconTablet,
    presets: [
      { id: 'ipad-mini', labelKey: 'framePresetIPadMini', width: 744, height: 1133 },
      { id: 'ipad-pro-11', labelKey: 'framePresetIPadPro11', width: 834, height: 1194 },
      { id: 'surface-pro-7', labelKey: 'framePresetSurfacePro7', width: 912, height: 1368 }
    ]
  },
  {
    key: 'phone',
    labelKey: 'framePresetCategoryPhone',
    icon: IconSmartphone,
    presets: [
      { id: 'iphone-16-pro', labelKey: 'framePresetIPhone16Pro', width: 402, height: 874 },
      { id: 'iphone-se', labelKey: 'framePresetIPhoneSE', width: 375, height: 667 },
      { id: 'android-large', labelKey: 'framePresetAndroidLarge', width: 360, height: 800 }
    ]
  },
  {
    key: 'watch',
    labelKey: 'framePresetCategoryWatch',
    icon: IconWatch,
    presets: [
      { id: 'apple-watch-45', labelKey: 'framePresetAppleWatch45', width: 198, height: 242 },
      { id: 'apple-watch-41', labelKey: 'framePresetAppleWatch41', width: 176, height: 215 }
    ]
  }
]
