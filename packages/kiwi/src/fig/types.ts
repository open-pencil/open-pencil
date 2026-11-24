export interface GUID {
  sessionID: number
  localID: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface Vector {
  x: number
  y: number
}

export interface Matrix {
  m00: number
  m01: number
  m02: number
  m10: number
  m11: number
  m12: number
}

/** An image paint's adjustments, as the schema's `PaintFilterMessage` names them. */
export interface PaintFilter {
  tint?: number
  shadows?: number
  highlights?: number
  detail?: number
  exposure?: number
  vignette?: number
  temperature?: number
  vibrance?: number
  contrast?: number
  brightness?: number
}

/** fig.kiwi EasingData: a curve or spring by name, and the numbers it holds. */
export interface EasingDataValue {
  easingType?: string
  easingValue?: {
    bezierEasing?: { p1x?: number; p1y?: number; p2x?: number; p2y?: number }
    springEasing?: {
      stiffness?: number
      damping?: number
      mass?: number
      springType?: string
      springPlatform?: string
    }
  }
}
