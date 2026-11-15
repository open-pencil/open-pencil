import { computed } from 'vue'

import type { ConnectorLineType, StrokeCap } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'

/** A connector's line types and the caps FigJam offers at its ends, as menu options. */
export function useConnectorOptions() {
  const { panels } = useI18n()
  const lineOptions = computed<Array<{ value: ConnectorLineType; label: string }>>(() => [
    { value: 'ELBOWED', label: panels.value.connectorElbowed },
    { value: 'STRAIGHT', label: panels.value.connectorStraight },
    { value: 'CURVED', label: panels.value.connectorCurved }
  ])
  const capOptions = computed<Array<{ value: StrokeCap; label: string }>>(() => [
    { value: 'NONE', label: panels.value.strokeCapNone },
    { value: 'ARROW_LINES', label: panels.value.strokeCapArrowLines },
    { value: 'ARROW_EQUILATERAL', label: panels.value.strokeCapArrowEquilateral },
    { value: 'TRIANGLE_FILLED', label: panels.value.strokeCapTriangleFilled },
    { value: 'DIAMOND_FILLED', label: panels.value.strokeCapDiamondFilled },
    { value: 'CIRCLE_FILLED', label: panels.value.strokeCapCircleFilled }
  ])
  return { lineOptions, capOptions }
}
