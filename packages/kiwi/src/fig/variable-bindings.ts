import type { GUID } from './types'

export interface VariableBinding {
  variableID: GUID
}

export interface PaintWithVariableBinding {
  colorVariableBinding?: VariableBinding
}

export interface NodeChangeWithVariableBindings {
  fillPaints?: PaintWithVariableBinding[]
  strokePaints?: PaintWithVariableBinding[]
}

export interface VariableBindingCodec<Paint, NodeChange> {
  encodePaint(paint: Paint): Uint8Array
  encodeNodeChange(nodeChange: NodeChange): Uint8Array
}

export function encodeVarint(value: number): number[] {
  const bytes: number[] = []
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80)
    value >>>= 7
  }
  bytes.push(value)
  return bytes
}

export function encodePaintWithVariableBinding<Paint extends PaintWithVariableBinding>(
  codec: VariableBindingCodec<Omit<Paint, 'colorVariableBinding'>, unknown>,
  paint: Paint,
  variableSessionID: number,
  variableLocalID: number
): Uint8Array {
  const { colorVariableBinding: _, ...basePaint } = paint

  const baseBytes = codec.encodePaint(basePaint)
  const baseArray = Array.from(baseBytes)

  if (baseArray[baseArray.length - 1] === 0) {
    baseArray.pop()
  }

  baseArray.push(0x15, 0x01)
  baseArray.push(0x04, 0x01)
  baseArray.push(...encodeVarint(variableSessionID))
  baseArray.push(...encodeVarint(variableLocalID))
  baseArray.push(0x00, 0x00, 0x02, 0x03, 0x03, 0x04)
  baseArray.push(0x00, 0x00)

  return new Uint8Array(baseArray)
}

export function parseVariableId(variableId: string): GUID | null {
  const match = variableId.match(/VariableID:(\d+):(\d+)/)
  if (!match) return null
  return {
    sessionID: Number.parseInt(match[1] ?? '0', 10),
    localID: Number.parseInt(match[2] ?? '0', 10)
  }
}

export function encodeNodeChangeWithVariables<NodeChange extends NodeChangeWithVariableBindings>(
  codec: VariableBindingCodec<
    unknown,
    Omit<NodeChange, 'fillPaints' | 'strokePaints'> & {
      fillPaints?: Omit<PaintWithVariableBinding, 'colorVariableBinding'>[]
      strokePaints?: Omit<PaintWithVariableBinding, 'colorVariableBinding'>[]
    }
  >,
  nodeChange: NodeChange
): Uint8Array {
  const hasFillBinding = nodeChange.fillPaints?.some((paint) => paint.colorVariableBinding)
  const hasStrokeBinding = nodeChange.strokePaints?.some((paint) => paint.colorVariableBinding)

  if (!hasFillBinding && !hasStrokeBinding) {
    return codec.encodeNodeChange(nodeChange)
  }

  const cleanNodeChange = { ...nodeChange }
  if (cleanNodeChange.fillPaints) {
    cleanNodeChange.fillPaints = cleanNodeChange.fillPaints.map(
      ({ colorVariableBinding: _, ...rest }) => rest
    )
  }
  if (cleanNodeChange.strokePaints) {
    cleanNodeChange.strokePaints = cleanNodeChange.strokePaints.map(
      ({ colorVariableBinding: _, ...rest }) => rest
    )
  }

  const baseBytes = codec.encodeNodeChange(cleanNodeChange)
  let hex = Buffer.from(baseBytes).toString('hex')

  const fillBinding = nodeChange.fillPaints?.[0]?.colorVariableBinding
  if (hasFillBinding && fillBinding) {
    hex = injectVariableBinding(hex, '2601', fillBinding)
  }

  const strokeBinding = nodeChange.strokePaints?.[0]?.colorVariableBinding
  if (hasStrokeBinding && strokeBinding) {
    hex = injectVariableBinding(hex, '2701', strokeBinding)
  }

  return hexToBytes(hex)
}

function injectVariableBinding(hex: string, marker: string, binding: VariableBinding): string {
  const markerIdx = hex.indexOf(marker)
  if (markerIdx === -1) return hex

  const visiblePattern = '0401'
  const patternIdx = hex.indexOf(visiblePattern, markerIdx)
  if (patternIdx === -1) return hex

  let insertPoint = patternIdx + visiblePattern.length

  if (hex.slice(insertPoint, insertPoint + 4) === '0501') {
    insertPoint += 4
  }

  const varBytes = [
    0x15,
    0x01,
    0x04,
    0x01,
    ...encodeVarint(binding.variableID.sessionID),
    ...encodeVarint(binding.variableID.localID),
    0x00,
    0x00,
    0x02,
    0x03,
    0x03,
    0x04,
    0x00,
    0x00
  ]
  const varHex = Buffer.from(varBytes).toString('hex')

  const beforeVar = hex.slice(0, insertPoint)
  let afterIdx = insertPoint
  if (hex.slice(afterIdx, afterIdx + 2) === '00') {
    afterIdx += 2
  }
  const afterVar = hex.slice(afterIdx)

  return beforeVar + varHex + afterVar
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Hex string must have an even length')

  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}
