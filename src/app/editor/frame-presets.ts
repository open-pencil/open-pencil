export type FramePresetCategoryId =
  | 'phone'
  | 'tablet'
  | 'desktop'
  | 'presentation'
  | 'watch'
  | 'paper'
  | 'social-media'
  | 'figma-community'
  | 'archive'

export type FramePresetCategoryLabelKey =
  | 'framePresetCategoryPhone'
  | 'framePresetCategoryTablet'
  | 'framePresetCategoryDesktop'
  | 'framePresetCategoryPresentation'
  | 'framePresetCategoryWatch'
  | 'framePresetCategoryPaper'
  | 'framePresetCategorySocialMedia'
  | 'framePresetCategoryFigmaCommunity'
  | 'framePresetCategoryArchive'

export interface FramePreset {
  id: string
  /** Canonical Figma preset label, kept verbatim across locales. */
  name: string
  width: number
  height: number
}

export interface FramePresetCategory {
  id: FramePresetCategoryId
  labelKey: FramePresetCategoryLabelKey
  presets: readonly FramePreset[]
}

export const FRAME_PRESET_CATEGORIES: readonly FramePresetCategory[] = [
  {
    id: 'phone',
    labelKey: 'framePresetCategoryPhone',
    presets: [
      { id: 'iphone-17', name: 'iPhone 17', width: 402, height: 874 },
      { id: 'iphone-16-17-pro', name: 'iPhone 16 & 17 Pro', width: 402, height: 874 },
      { id: 'iphone-16', name: 'iPhone 16', width: 393, height: 852 },
      {
        id: 'iphone-16-17-pro-max',
        name: 'iPhone 16 & 17 Pro Max',
        width: 440,
        height: 956
      },
      { id: 'iphone-16-plus', name: 'iPhone 16 Plus', width: 430, height: 932 },
      { id: 'iphone-air', name: 'iPhone Air', width: 420, height: 912 },
      {
        id: 'iphone-14-15-pro-max',
        name: 'iPhone 14 & 15 Pro Max',
        width: 430,
        height: 932
      },
      { id: 'iphone-14-15-pro', name: 'iPhone 14 & 15 Pro', width: 393, height: 852 },
      { id: 'iphone-13-14', name: 'iPhone 13 & 14', width: 390, height: 844 },
      { id: 'iphone-14-plus', name: 'iPhone 14 Plus', width: 428, height: 926 },
      { id: 'android-compact', name: 'Android Compact', width: 412, height: 917 },
      { id: 'android-medium', name: 'Android Medium', width: 700, height: 840 }
    ]
  },
  {
    id: 'tablet',
    labelKey: 'framePresetCategoryTablet',
    presets: [
      { id: 'ipad-mini-8-3', name: 'iPad mini 8.3', width: 744, height: 1133 },
      { id: 'surface-pro-8', name: 'Surface Pro 8', width: 1440, height: 960 },
      { id: 'ipad-pro-11', name: 'iPad Pro 11"', width: 834, height: 1194 },
      { id: 'ipad-pro-12-9', name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
      { id: 'android-expanded', name: 'Android Expanded', width: 1280, height: 800 }
    ]
  },
  {
    id: 'desktop',
    labelKey: 'framePresetCategoryDesktop',
    presets: [
      { id: 'macbook-air', name: 'MacBook Air', width: 1280, height: 832 },
      { id: 'macbook-pro-14', name: 'MacBook Pro 14"', width: 1512, height: 982 },
      { id: 'macbook-pro-16', name: 'MacBook Pro 16"', width: 1728, height: 1117 },
      { id: 'desktop', name: 'Desktop', width: 1440, height: 1024 },
      { id: 'wireframe', name: 'Wireframe', width: 1440, height: 1024 },
      { id: 'tv', name: 'TV', width: 1280, height: 720 }
    ]
  },
  {
    id: 'presentation',
    labelKey: 'framePresetCategoryPresentation',
    presets: [
      { id: 'slide-16-9', name: 'Slide 16:9', width: 1920, height: 1080 },
      { id: 'slide-4-3', name: 'Slide 4:3', width: 1024, height: 768 }
    ]
  },
  {
    id: 'watch',
    labelKey: 'framePresetCategoryWatch',
    presets: [
      {
        id: 'apple-watch-series-10-42',
        name: 'Apple Watch Series 10 42mm',
        width: 187,
        height: 223
      },
      {
        id: 'apple-watch-series-10-46',
        name: 'Apple Watch Series 10 46mm',
        width: 208,
        height: 248
      },
      { id: 'apple-watch-41', name: 'Apple Watch 41mm', width: 176, height: 215 },
      { id: 'apple-watch-45', name: 'Apple Watch 45mm', width: 198, height: 242 },
      { id: 'apple-watch-44', name: 'Apple Watch 44mm', width: 184, height: 224 },
      { id: 'apple-watch-40', name: 'Apple Watch 40mm', width: 162, height: 197 }
    ]
  },
  {
    id: 'paper',
    labelKey: 'framePresetCategoryPaper',
    presets: [
      { id: 'a4', name: 'A4', width: 595, height: 842 },
      { id: 'a5', name: 'A5', width: 420, height: 595 },
      { id: 'a6', name: 'A6', width: 297, height: 420 },
      { id: 'letter', name: 'Letter', width: 612, height: 792 },
      { id: 'tabloid', name: 'Tabloid', width: 792, height: 1224 }
    ]
  },
  {
    id: 'social-media',
    labelKey: 'framePresetCategorySocialMedia',
    presets: [
      { id: 'twitter-post', name: 'Twitter post', width: 1200, height: 675 },
      { id: 'twitter-header', name: 'Twitter header', width: 1500, height: 500 },
      { id: 'facebook-post', name: 'Facebook post', width: 1200, height: 630 },
      { id: 'facebook-cover', name: 'Facebook cover', width: 820, height: 312 },
      { id: 'instagram-post', name: 'Instagram post', width: 1080, height: 1350 },
      { id: 'instagram-story', name: 'Instagram story', width: 1080, height: 1920 },
      { id: 'dribbble-shot', name: 'Dribbble shot', width: 400, height: 300 },
      { id: 'dribbble-shot-hd', name: 'Dribbble shot HD', width: 800, height: 600 },
      { id: 'linkedin-cover', name: 'LinkedIn cover', width: 1584, height: 396 }
    ]
  },
  {
    id: 'figma-community',
    labelKey: 'framePresetCategoryFigmaCommunity',
    presets: [
      { id: 'plugin-icon', name: 'Plugin icon', width: 128, height: 128 },
      { id: 'profile-banner', name: 'Profile banner', width: 1680, height: 240 },
      { id: 'plugin-file-cover', name: 'Plugin / file cover', width: 1920, height: 1080 }
    ]
  },
  {
    id: 'archive',
    labelKey: 'framePresetCategoryArchive',
    presets: [
      { id: 'iphone-13-mini', name: 'iPhone 13 mini', width: 375, height: 812 },
      { id: 'iphone-se', name: 'iPhone SE', width: 320, height: 568 },
      { id: 'iphone-13-pro-max', name: 'iPhone 13 Pro Max', width: 428, height: 926 },
      { id: 'iphone-13-pro', name: 'iPhone 13 / 13 Pro', width: 390, height: 844 },
      { id: 'iphone-11-pro-max', name: 'iPhone 11 Pro Max', width: 414, height: 896 },
      { id: 'iphone-11-pro-x', name: 'iPhone 11 Pro / X', width: 375, height: 812 },
      { id: 'iphone-8-plus', name: 'iPhone 8 Plus', width: 414, height: 736 },
      { id: 'iphone-8', name: 'iPhone 8', width: 375, height: 667 },
      { id: 'android-small', name: 'Android Small', width: 360, height: 640 },
      { id: 'android-large', name: 'Android Large', width: 360, height: 800 },
      { id: 'google-pixel-2', name: 'Google Pixel 2', width: 411, height: 731 },
      { id: 'google-pixel-2-xl', name: 'Google Pixel 2 XL', width: 411, height: 823 },
      { id: 'ipad-mini-5', name: 'iPad mini 5', width: 768, height: 1024 },
      { id: 'surface-pro-4', name: 'Surface Pro 4', width: 1368, height: 912 },
      { id: 'macbook', name: 'MacBook', width: 1152, height: 700 },
      { id: 'macbook-pro', name: 'MacBook Pro', width: 1440, height: 900 },
      { id: 'surface-book', name: 'Surface Book', width: 1500, height: 1000 },
      { id: 'apple-watch-42', name: 'Apple Watch 42mm', width: 156, height: 195 },
      { id: 'apple-watch-38', name: 'Apple Watch 38mm', width: 136, height: 170 },
      { id: 'imac', name: 'iMac', width: 1280, height: 720 },
      { id: 'macintosh-128k', name: 'Macintosh 128k', width: 512, height: 342 }
    ]
  }
]

export const FRAME_PRESETS = FRAME_PRESET_CATEGORIES.flatMap((category) => category.presets)

function uniquePresetCategoriesBySize(
  categories: readonly FramePresetCategory[]
): readonly FramePresetCategory[] {
  const seenSizes = new Set<string>()
  return categories
    .map((category) => ({
      ...category,
      presets: category.presets.filter((preset) => {
        const size = `${preset.width}x${preset.height}`
        if (seenSizes.has(size)) return false
        seenSizes.add(size)
        return true
      })
    }))
    .filter((category) => category.presets.length > 0)
}

export const FRAME_RESIZE_PRESET_CATEGORIES = uniquePresetCategoriesBySize(FRAME_PRESET_CATEGORIES)
export const FRAME_RESIZE_PRESETS = FRAME_RESIZE_PRESET_CATEGORIES.flatMap(
  (category) => category.presets
)

function findPreset(
  presets: readonly FramePreset[],
  width: number,
  height: number,
  preferredName?: string
): FramePreset | undefined {
  const matches = presets.filter((preset) => preset.width === width && preset.height === height)
  return matches.find((preset) => preset.name === preferredName) ?? matches[0]
}

export function findFrameResizePreset(
  width: number,
  height: number,
  preferredName?: string
): FramePreset | undefined {
  return findPreset(FRAME_RESIZE_PRESETS, width, height, preferredName)
}
