import { isEqual } from 'es-toolkit/predicate'

import type { CubicBezier, Easing, EasingCurve, Spring, VariableValue } from '../types'

const EASE_IN_AND_OUT: CubicBezier = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }

/** The curve each cubic preset eases along, as Figma writes it beside the preset's name. */
const PRESET_BEZIERS: Partial<Record<EasingCurve, CubicBezier>> = {
  // A new easing variable in Figma holds `IN_CUBIC` with no numbers, which its editor draws and
  // names as Ease in.
  IN_CUBIC: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  EASE_IN: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  OUT_CUBIC: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  INOUT_CUBIC: EASE_IN_AND_OUT,
  LINEAR: { x1: 0, y1: 0, x2: 1, y2: 1 },
  IN_BACK_CUBIC: { x1: 0.3, y1: -0.05, x2: 0.7, y2: -0.5 },
  OUT_BACK_CUBIC: { x1: 0.45, y1: 1.45, x2: 0.8, y2: 1 },
  INOUT_BACK_CUBIC: { x1: 0.7, y1: -0.4, x2: 0.4, y2: 1.4 }
}

/** The spring each spring preset is. */
const PRESET_SPRINGS: Partial<Record<EasingCurve, Spring>> = {
  GENTLE_SPRING: { stiffness: 100, damping: 15, mass: 1 },
  SPRING_PRESET_ONE: { stiffness: 300, damping: 20, mass: 1 },
  SPRING_PRESET_TWO: { stiffness: 600, damping: 15, mass: 1 },
  SPRING_PRESET_THREE: { stiffness: 80, damping: 20, mass: 1 }
}

const SPRING_CURVES = new Set<EasingCurve>([
  'SPRING',
  'GENTLE_SPRING',
  'CUSTOM_SPRING',
  'SPRING_PRESET_ONE',
  'SPRING_PRESET_TWO',
  'SPRING_PRESET_THREE'
])

/** The stiffness and mass a spring edited by its bounce keeps, as Figma keeps them. */
const BOUNCE_STIFFNESS = 100
const BOUNCE_MASS = 1

export function isEasing(value: VariableValue | undefined): value is Easing {
  return typeof value === 'object' && 'easing' in value
}

export function isSpringCurve(curve: EasingCurve): boolean {
  return SPRING_CURVES.has(curve)
}

/** The curve an easing follows: its own, or its preset's; springs and `HOLD` have none. */
export function easingBezier(easing: Easing): CubicBezier | undefined {
  if (isSpringCurve(easing.easing)) return undefined
  return easing.bezier ?? PRESET_BEZIERS[easing.easing]
}

/** The spring an easing is: its own, or its preset's; curves have none. */
export function easingSpring(easing: Easing): Spring | undefined {
  if (!isSpringCurve(easing.easing)) return undefined
  return easing.spring ?? PRESET_SPRINGS[easing.easing]
}

/** The curves a curve's numbers name: the preset with exactly them, else a custom curve. */
const NAMED_CURVES: readonly EasingCurve[] = [
  'EASE_IN',
  'OUT_CUBIC',
  'INOUT_CUBIC',
  'LINEAR',
  'IN_BACK_CUBIC',
  'OUT_BACK_CUBIC',
  'INOUT_BACK_CUBIC'
]

/** An easing along this curve: the preset with exactly these numbers, else a custom curve. */
export function easingForBezier(bezier: CubicBezier): Easing {
  const preset = NAMED_CURVES.find((curve) => isEqual(PRESET_BEZIERS[curve], bezier))
  return preset ? easingPreset(preset) : { easing: 'CUSTOM_CUBIC', bezier: { ...bezier } }
}

/** A preset with the numbers Figma writes beside it, or a custom curve or spring to start from. */
export function easingPreset(curve: EasingCurve): Easing {
  if (curve === 'HOLD') return { easing: curve }
  if (curve === 'CUSTOM_CUBIC') return { easing: curve, bezier: { ...EASE_IN_AND_OUT } }
  if (curve === 'CUSTOM_SPRING' || curve === 'SPRING')
    return { easing: curve, spring: springWithBounce(0) }
  const spring = PRESET_SPRINGS[curve]
  if (spring) return { easing: curve, spring: { ...spring } }
  const bezier = PRESET_BEZIERS[curve]
  return bezier ? { easing: curve, bezier: { ...bezier } } : { easing: curve }
}

/**
 * How far a spring overshoots, from 0 (none) to 1 (it never settles): one less its damping
 * ratio, as Figma's bounce is.
 */
export function springBounce(spring: Spring): number {
  const critical = 2 * Math.sqrt(spring.stiffness * spring.mass)
  return critical > 0 ? Math.max(0, 1 - spring.damping / critical) : 0
}

/** The spring with this bounce, at the stiffness and mass Figma gives a spring edited by bounce. */
export function springWithBounce(bounce: number): Spring {
  const critical = 2 * Math.sqrt(BOUNCE_STIFFNESS * BOUNCE_MASS)
  const clamped = Math.min(1, Math.max(0, bounce))
  return { stiffness: BOUNCE_STIFFNESS, damping: critical * (1 - clamped), mass: BOUNCE_MASS }
}

/** The names Figma gives its presets. */
const PRESET_NAMES: Partial<Record<EasingCurve, string>> = {
  IN_CUBIC: 'Ease in',
  EASE_IN: 'Ease in',
  OUT_CUBIC: 'Ease out',
  INOUT_CUBIC: 'Ease in and out',
  LINEAR: 'Linear',
  IN_BACK_CUBIC: 'Ease in back',
  OUT_BACK_CUBIC: 'Ease out back',
  INOUT_BACK_CUBIC: 'Ease in and out back',
  GENTLE_SPRING: 'Gentle',
  SPRING_PRESET_ONE: 'Quick',
  SPRING_PRESET_TWO: 'Bouncy',
  SPRING_PRESET_THREE: 'Slow',
  HOLD: 'Hold'
}

function round(value: number, digits = 2): string {
  return String(Number(value.toFixed(digits)))
}

/**
 * An easing as a line of text, as Figma's variables table shows it: a preset by name, a custom
 * curve as `cubic-bezier(…)`, a spring by its bounce, `spring(0.4)`, or, one edited by its
 * physics, `physical-spring(stiffness, damping, mass)`.
 */
export function easingText(easing: Easing): string {
  const preset = PRESET_NAMES[easing.easing]
  if (preset) return preset
  const spring = easingSpring(easing)
  if (spring?.type === 'PHYSICAL')
    return `physical-spring(${[spring.stiffness, spring.damping, spring.mass].map((value) => round(value)).join(', ')})`
  if (spring) return `spring(${round(springBounce(spring))})`
  const bezier = easingBezier(easing)
  if (!bezier) return easing.easing
  return `cubic-bezier(${[bezier.x1, bezier.y1, bezier.x2, bezier.y2].map((value) => round(value)).join(', ')})`
}

/** How close to its target a spring counts as settled. */
const SETTLED = 0.001
/** The longest a spring is followed, for one that barely damps. */
const MAX_SPRING_SECONDS = 10

function springMotion(spring: Spring) {
  const natural = Math.sqrt(spring.stiffness / spring.mass)
  const ratio = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass))
  return { natural, ratio }
}

/** Where a spring released at rest from 0 towards 1 is after `seconds`. */
export function springPosition(spring: Spring, seconds: number): number {
  const { natural, ratio } = springMotion(spring)
  if (!(natural > 0)) return 1
  if (ratio < 1) {
    const damped = natural * Math.sqrt(1 - ratio * ratio)
    const decay = Math.exp(-ratio * natural * seconds)
    return (
      1 -
      decay *
        (Math.cos(damped * seconds) + ((ratio * natural) / damped) * Math.sin(damped * seconds))
    )
  }
  if (ratio === 1) return 1 - (1 + natural * seconds) * Math.exp(-natural * seconds)
  const spread = natural * Math.sqrt(ratio * ratio - 1)
  const slow = -ratio * natural + spread
  const fast = -ratio * natural - spread
  return (
    1 +
    (-fast / (fast - slow)) * Math.exp(slow * seconds) +
    (slow / (fast - slow)) * Math.exp(fast * seconds)
  )
}

/** How long a spring takes to come within a thousandth of its target and stay there. */
export function springSettleTime(spring: Spring): number {
  const { natural, ratio } = springMotion(spring)
  if (!(natural > 0) || !(ratio > 0)) return MAX_SPRING_SECONDS
  return Math.min(MAX_SPRING_SECONDS, settleBound(natural, ratio))
}

/**
 * When the response's bound, its decay times the largest its oscillation or second term can add,
 * falls under `SETTLED`: the decay alone undershoots for a spring damped close to critical.
 */
function settleBound(natural: number, ratio: number): number {
  const tolerance = Math.log(1 / SETTLED)
  if (ratio < 1) {
    // The oscillation's amplitude is 1 / sqrt(1 - ratio²) of the decay.
    const amplitude = 1 / Math.sqrt(1 - ratio * ratio)
    return (tolerance + Math.log(amplitude)) / (ratio * natural)
  }
  if (ratio > 1) {
    const spread = natural * Math.sqrt(ratio * ratio - 1)
    const slow = -ratio * natural + spread
    const fast = -ratio * natural - spread
    // Both terms decay at least as fast as the slow root; their weights add at most this much.
    const weight = (Math.abs(fast) + Math.abs(slow)) / (slow - fast)
    return (tolerance + Math.log(weight)) / -slow
  }
  // Critically damped: 1 - x = (1 + ωt) e^(-ωt); a few fixed-point steps solve it for SETTLED.
  let seconds = tolerance / natural
  for (let step = 0; step < 8; step++)
    seconds = (tolerance + Math.log(1 + natural * seconds)) / natural
  return seconds
}

/** The first overshoot of a bouncing spring: when it comes, and how far past 1 it goes. */
export function springPeak(spring: Spring): { seconds: number; value: number } | undefined {
  const { natural, ratio } = springMotion(spring)
  if (!(natural > 0) || ratio >= 1) return undefined
  const root = Math.sqrt(1 - ratio * ratio)
  return {
    seconds: Math.PI / (natural * root),
    value: 1 + Math.exp((-ratio * Math.PI) / root)
  }
}

/** The bounce whose spring overshoots its target by `overshoot` (0 to 1) at its first peak. */
export function bounceForOvershoot(overshoot: number): number {
  if (overshoot <= 0) return 0
  if (overshoot >= 1) return 1
  const log = Math.log(overshoot)
  return 1 - -log / Math.hypot(Math.PI, log)
}
