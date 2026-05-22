import type { Color, Effect } from '@open-pencil/core/scene-graph'

export function dropShadow(
  ox = 0,
  oy = 4,
  radius = 8,
  spread = 0,
  color: Color = { r: 0, g: 0, b: 0, a: 0.25 }
): Effect {
  return {
    type: 'DROP_SHADOW',
    color,
    offset: { x: ox, y: oy },
    radius,
    spread,
    visible: true
  }
}

export function innerShadow(
  ox = 0,
  oy = 2,
  radius = 4,
  spread = 0,
  color: Color = { r: 0, g: 0, b: 0, a: 0.2 }
): Effect {
  return {
    type: 'INNER_SHADOW',
    color,
    offset: { x: ox, y: oy },
    radius,
    spread,
    visible: true
  }
}

export function blurEffect(
  type: 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'FOREGROUND_BLUR',
  radius: number
): Effect {
  return {
    type,
    radius,
    visible: true
  }
}
