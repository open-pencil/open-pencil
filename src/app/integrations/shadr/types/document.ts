export interface ShadrScreen {
  width: number
  height: number
  cursorSize?: number
  cursorSpeed?: number
  cursorLayer?: number
}

export interface ShadrPosition {
  x: number | string
  y: number | string
}

export interface ShadrSize {
  width: number | string
  height: number | string
}

export interface ShadrRounding {
  radius?: number
  size?: 'small' | 'medium' | 'large'
}

export interface ShadrPage {
  name: string
  screen: ShadrScreen
  blocks: import('./element').ShadrElement[]
  animations?: unknown[]
}

export interface ShadrComponent {
  params: Record<string, unknown>
  blocks: import('./element').ShadrElement[]
}
