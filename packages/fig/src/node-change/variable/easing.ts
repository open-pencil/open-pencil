import * as v from 'valibot'

import type { EasingDataValue } from '@open-pencil/kiwi/fig'
import type { Easing } from '@open-pencil/scene-graph'
import { easingSchema } from '@open-pencil/scene-graph/variables'

/** An EASING value as a file stores it; one of a kind OpenPencil does not know is refused. */
export function easingFromKiwi(data: EasingDataValue): Easing {
  const { bezierEasing: bezier, springEasing: spring } = data.easingValue ?? {}
  return v.parse(easingSchema, {
    easing: data.easingType,
    ...(bezier && {
      bezier: { x1: bezier.p1x ?? 0, y1: bezier.p1y ?? 0, x2: bezier.p2x ?? 0, y2: bezier.p2y ?? 0 }
    }),
    ...(spring && {
      spring: {
        stiffness: spring.stiffness ?? 0,
        damping: spring.damping ?? 0,
        mass: spring.mass ?? 0,
        ...(spring.springType && { type: spring.springType }),
        ...(spring.springPlatform && { platform: spring.springPlatform })
      }
    })
  })
}

/** An easing as a file stores it: its name, and the curve or spring it holds, if any. */
export function easingToKiwi(easing: Easing): EasingDataValue {
  const { bezier, spring } = easing
  if (!bezier && !spring) return { easingType: easing.easing }
  return {
    easingType: easing.easing,
    easingValue: {
      ...(bezier && {
        bezierEasing: { p1x: bezier.x1, p1y: bezier.y1, p2x: bezier.x2, p2y: bezier.y2 }
      }),
      ...(spring && {
        springEasing: {
          stiffness: spring.stiffness,
          damping: spring.damping,
          mass: spring.mass,
          ...(spring.type && { springType: spring.type }),
          ...(spring.platform && { springPlatform: spring.platform })
        }
      })
    }
  }
}
