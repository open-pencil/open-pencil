import { h, type FunctionalComponent } from 'vue'

import { svgDataURL } from '@open-pencil/scene-graph/images'

/**
 * An icon drawn from `svg` in the text color through a mask, so the markup never runs in the
 * page; the caller's class sizes it. For icons drawn from scene geometry, such as a shape's
 * outline or a connector's cap, that no icon set has.
 */
export function maskIcon(svg: string): FunctionalComponent {
  const mask = `url("${svgDataURL(svg)}")`
  return (_props, { attrs }) =>
    h('span', {
      ...attrs,
      'aria-hidden': 'true',
      class: [
        'inline-block shrink-0 bg-current mask-(--mask-icon) mask-contain mask-center mask-no-repeat',
        attrs.class
      ],
      style: { '--mask-icon': mask }
    })
}
