import type { GUID } from '#core/types'
import type { NodeChange, Paint } from './codec'

export interface VariableBindingCodec {
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

export function encodePaintWithVariableBinding(
  codec: VariableBindingCodec,
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
    sessionID: parseInt(match[1] ?? '0', 10),
    localID: parseInt(match[2] ?? '0', 10)
  }
}

export function encodeNodeChangeWithVariables(
  codec: VariableBindingCodec,
  nodeChange: NodeChange
): Uint8Array {
  const hasFillBinding = nodeChange.fillPaints?.some((p) => p.colorVariableBinding)
  const hasStrokeBinding = nodeChange.strokePaints?.some((p) => p.colorVariableBinding)

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

  return new Uint8Array(hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? [])
}

function injectVariableBinding(hex: string, marker: string, binding: { variableID: GUID }): string {
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
