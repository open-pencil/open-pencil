import type { OutlineCommand } from '#core/text/opentype'

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_CUBIC_TO = 4

export function encodePathCommandsBlob(commands: OutlineCommand[], scale = 1): Uint8Array {
  const bytes: number[] = []
  const pushFloat = (value: number | undefined) => {
    const buf = new ArrayBuffer(4)
    new DataView(buf).setFloat32(0, (value ?? 0) / scale, true)
    bytes.push(...new Uint8Array(buf))
  }

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        bytes.push(CMD_MOVE_TO)
        pushFloat(command.x)
        pushFloat(command.y === undefined ? undefined : -command.y)
        break
      case 'L':
        bytes.push(CMD_LINE_TO)
        pushFloat(command.x)
        pushFloat(command.y === undefined ? undefined : -command.y)
        break
      case 'C':
        bytes.push(CMD_CUBIC_TO)
        pushFloat(command.x1)
        pushFloat(command.y1 === undefined ? undefined : -command.y1)
        pushFloat(command.x2)
        pushFloat(command.y2 === undefined ? undefined : -command.y2)
        pushFloat(command.x)
        pushFloat(command.y === undefined ? undefined : -command.y)
        break
      case 'Q':
        bytes.push(CMD_LINE_TO)
        pushFloat(command.x)
        pushFloat(command.y === undefined ? undefined : -command.y)
        break
      case 'Z':
        bytes.push(CMD_CLOSE)
        break
    }
  }

  return new Uint8Array(bytes)
}
