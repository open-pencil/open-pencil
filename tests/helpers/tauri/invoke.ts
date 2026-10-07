import type { invoke } from '@tauri-apps/api/core'

type InvokeArguments = Parameters<typeof invoke>[1]

/** Invoke inside the built WebView; package imports cannot execute in serialized callbacks. */
export async function invokeNative<T>(command: string, args?: InvokeArguments): Promise<T> {
  return browser.execute(
    async (command, args) => {
      const core = window.__TAURI__?.core
      if (!core) throw new Error('Native test requires app.withGlobalTauri')
      return core.invoke<T>(command, args)
    },
    command,
    args
  )
}

/** Invoke a command that returns raw bytes; WebDriver cannot serialize an ArrayBuffer. */
export async function invokeNativeBytes(
  command: string,
  args?: InvokeArguments
): Promise<number[]> {
  return browser.execute(
    async (command, args) => {
      const core = window.__TAURI__?.core
      if (!core) throw new Error('Native test requires app.withGlobalTauri')
      const data = await core.invoke<ArrayBuffer | number[]>(command, args)
      return Array.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data)
    },
    command,
    args
  )
}

/** Writes a file through the fs plugin the way `writeFile` does, and returns its error if any. */
export async function writeNativeFile(path: string, text: string): Promise<string | null> {
  return browser.execute(
    async (path, text) => {
      const core = window.__TAURI__?.core
      if (!core) throw new Error('Native test requires app.withGlobalTauri')
      try {
        await core.invoke('plugin:fs|write_file', new TextEncoder().encode(text), {
          headers: { path: encodeURIComponent(path), options: JSON.stringify({}) }
        })
        return null
      } catch (error) {
        return String(error)
      }
    },
    path,
    text
  )
}
