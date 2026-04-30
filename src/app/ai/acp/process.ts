import { decodeTauriStderr } from '@/app/shell/ui'

export type TauriChild = {
  write(data: number[]): Promise<void>
  kill(): Promise<void>
}

type AcpProcessOptions = {
  command: string
  args: string[]
  logId: string
  destroying: () => boolean
  onUnexpectedClose: () => void
}

export async function spawnAcpProcess({
  command: commandName,
  args,
  logId,
  destroying,
  onUnexpectedClose
}: AcpProcessOptions) {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const command = Command.create(commandName, args, { encoding: 'raw' })

  const stdoutChunks: Uint8Array[] = []
  let stdoutResolver: ((chunk: Uint8Array | null) => void) | null = null
  let stdoutClosed = false
  let stdoutClosedError: Error | null = null

  command.stdout.on('data', (raw: Uint8Array | number[]) => {
    const chunk = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
    if (stdoutResolver) {
      const resolve = stdoutResolver
      stdoutResolver = null
      resolve(chunk)
    } else {
      stdoutChunks.push(chunk)
    }
  })

  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    console.error(`[ACP ${logId}]`, decodeTauriStderr(raw))
  })

  command.on('close', () => {
    stdoutClosed = true
    stdoutClosedError = destroying() ? null : new Error('Agent process exited unexpectedly.')
    if (stdoutResolver) {
      const resolve = stdoutResolver
      stdoutResolver = null
      resolve(null)
    }
    if (!destroying()) {
      onUnexpectedClose()
    }
  })

  const child = await command.spawn()

  const output = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const buffered = stdoutChunks.shift()
      if (buffered) {
        controller.enqueue(buffered)
        return
      }
      if (stdoutClosed) {
        if (stdoutClosedError) controller.error(stdoutClosedError)
        else controller.close()
        return
      }
      const chunk = await new Promise<Uint8Array | null>((resolve) => {
        stdoutResolver = resolve
      })
      if (chunk) {
        controller.enqueue(chunk)
        return
      }
      if (stdoutClosedError) controller.error(stdoutClosedError)
      else controller.close()
    }
  })

  const input = new WritableStream<Uint8Array>({
    async write(chunk) {
      await child.write(Array.from(chunk))
    }
  })

  return { child, input, output }
}
