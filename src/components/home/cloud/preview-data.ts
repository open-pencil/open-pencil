import type { CloudDocumentRow } from './types'

/** A stand-in canvas preview: a few frames on a page in one hue. */
function preview(hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
<rect width="320" height="180" fill="hsl(${hue} 18% 14%)"/>
<rect x="24" y="28" width="132" height="124" rx="6" fill="hsl(${hue} 30% 92%)"/>
<rect x="36" y="42" width="64" height="8" rx="2" fill="hsl(${hue} 60% 45%)"/>
<rect x="36" y="58" width="104" height="5" rx="2" fill="hsl(${hue} 10% 70%)"/>
<rect x="36" y="68" width="88" height="5" rx="2" fill="hsl(${hue} 10% 70%)"/>
<rect x="36" y="118" width="48" height="18" rx="4" fill="hsl(${hue} 60% 50%)"/>
<rect x="172" y="28" width="124" height="58" rx="6" fill="hsl(${hue} 55% 55%)"/>
<rect x="172" y="94" width="58" height="58" rx="6" fill="hsl(${(hue + 40) % 360} 45% 60%)"/>
<rect x="238" y="94" width="58" height="58" rx="6" fill="hsl(${hue} 25% 85%)"/>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const previewDocuments: CloudDocumentRow[] = [
  {
    id: '1',
    name: 'Homepage redesign',
    previewURL: preview(220),
    editedAt: 'Edited 4 min ago',
    editedBy: 'Ana',
    sync: 'synced',
    shared: true,
    permission: 'edit'
  },
  {
    id: '2',
    name: 'Mobile onboarding',
    previewURL: preview(150),
    editedAt: 'Edited 1 hour ago',
    editedBy: 'You',
    sync: 'uploading',
    permission: 'edit'
  },
  {
    id: '3',
    name: 'Pricing page',
    previewURL: preview(30),
    editedAt: 'Edited yesterday',
    editedBy: 'Ben',
    sync: 'conflict',
    permission: 'edit'
  },
  {
    id: '4',
    name: 'Design system — tokens',
    previewURL: preview(280),
    editedAt: 'Edited 3 days ago',
    editedBy: 'Ana',
    sync: 'synced',
    permission: 'view'
  },
  {
    id: '5',
    name: 'Checkout flow',
    previewURL: preview(340),
    editedAt: 'Edited last week',
    editedBy: 'You',
    sync: 'pending',
    permission: 'edit'
  },
  {
    id: '6',
    name: 'Brand moodboard',
    previewURL: preview(190),
    editedAt: 'Edited Sep 28',
    editedBy: 'Chloe',
    sync: 'synced',
    shared: true,
    permission: 'edit'
  }
]
