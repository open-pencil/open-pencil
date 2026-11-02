/** Canvas sizes, in pixels, that each platform recommends for a post. */
export const SOCIAL_FORMATS = {
  'instagram-post': { platform: 'Instagram', label: 'Post (square)', width: 1080, height: 1080 },
  'instagram-portrait': {
    platform: 'Instagram',
    label: 'Post (portrait)',
    width: 1080,
    height: 1350
  },
  'instagram-story': { platform: 'Instagram', label: 'Story / Reel', width: 1080, height: 1920 },
  'tiktok-video': { platform: 'TikTok', label: 'Video cover', width: 1080, height: 1920 },
  'snapchat-story': { platform: 'Snapchat', label: 'Story', width: 1080, height: 1920 },
  'whatsapp-status': { platform: 'WhatsApp', label: 'Status', width: 1080, height: 1920 },
  'x-post': { platform: 'X', label: 'Post image', width: 1600, height: 900 },
  'x-header': { platform: 'X', label: 'Header', width: 1500, height: 500 },
  'facebook-post': { platform: 'Facebook', label: 'Post', width: 1200, height: 630 },
  'facebook-cover': { platform: 'Facebook', label: 'Cover', width: 1640, height: 624 },
  'linkedin-post': { platform: 'LinkedIn', label: 'Post', width: 1200, height: 627 },
  'linkedin-banner': { platform: 'LinkedIn', label: 'Banner', width: 1584, height: 396 },
  'youtube-thumbnail': { platform: 'YouTube', label: 'Thumbnail', width: 1280, height: 720 },
  'youtube-banner': { platform: 'YouTube', label: 'Channel banner', width: 2560, height: 1440 },
  'pinterest-pin': { platform: 'Pinterest', label: 'Pin', width: 1000, height: 1500 },
  'a4-portrait': { platform: 'Print', label: 'A4 portrait (150 dpi)', width: 1240, height: 1754 },
  'poster-18x24': {
    platform: 'Print',
    label: 'Poster 18×24 in (100 dpi)',
    width: 1800,
    height: 2400
  }
} as const

export type SocialFormatId = keyof typeof SOCIAL_FORMATS
export const SOCIAL_FORMAT_IDS = Object.keys(SOCIAL_FORMATS) as [
  SocialFormatId,
  ...SocialFormatId[]
]

export interface DevicePreset {
  label: string
  /** Outer body size. */
  width: number
  height: number
  bodyRadius: number
  /** Screen rectangle inside the body. */
  screen: { x: number; y: number; width: number; height: number; radius: number }
  kind: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'browser' | 'watch'
}

/** Device bodies drawn as plain editable layers; screens follow common logical resolutions. */
export const DEVICES = {
  'phone-modern': {
    label: 'Phone (edge-to-edge, 393×852 screen)',
    kind: 'phone',
    width: 425,
    height: 884,
    bodyRadius: 68,
    screen: { x: 16, y: 16, width: 393, height: 852, radius: 54 }
  },
  'phone-compact': {
    label: 'Phone compact (375×667 screen)',
    kind: 'phone',
    width: 407,
    height: 819,
    bodyRadius: 56,
    screen: { x: 16, y: 76, width: 375, height: 667, radius: 4 }
  },
  tablet: {
    label: 'Tablet (820×1180 screen)',
    kind: 'tablet',
    width: 868,
    height: 1228,
    bodyRadius: 44,
    screen: { x: 24, y: 24, width: 820, height: 1180, radius: 20 }
  },
  laptop: {
    label: 'Laptop (1440×900 screen)',
    kind: 'laptop',
    width: 1520,
    height: 1010,
    bodyRadius: 24,
    screen: { x: 40, y: 34, width: 1440, height: 900, radius: 4 }
  },
  desktop: {
    label: 'Desktop monitor (1920×1080 screen)',
    kind: 'desktop',
    width: 1980,
    height: 1380,
    bodyRadius: 24,
    screen: { x: 30, y: 30, width: 1920, height: 1080, radius: 4 }
  },
  browser: {
    label: 'Browser window (1440×900 viewport)',
    kind: 'browser',
    width: 1440,
    height: 952,
    bodyRadius: 12,
    screen: { x: 0, y: 52, width: 1440, height: 900, radius: 0 }
  },
  watch: {
    label: 'Watch (198×242 screen)',
    kind: 'watch',
    width: 230,
    height: 274,
    bodyRadius: 64,
    screen: { x: 16, y: 16, width: 198, height: 242, radius: 50 }
  }
} as const satisfies Record<string, DevicePreset>

export type DeviceId = keyof typeof DEVICES
export const DEVICE_IDS = Object.keys(DEVICES) as [DeviceId, ...DeviceId[]]
