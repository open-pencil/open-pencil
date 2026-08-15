import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface ScreenPoint {
  x: number
  y: number
}

interface ElementScreenGeometry extends ScreenPoint {
  height: number
  width: number
}

const USER32_DECLARATION = String.raw`
using System;
using System.Runtime.InteropServices;
public static class NativeInput {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr window, int command);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}`

const FOREGROUND_SCRIPT = String.raw`
$process = Get-Process OpenPencil -ErrorAction Stop | Select-Object -First 1
[NativeInput]::ShowWindow($process.MainWindowHandle, 9) | Out-Null
[NativeInput]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 150
`

async function runPowerShell(script: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('Win32 input is only available on Windows')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  await execFileAsync('powershell.exe', ['-NoProfile', '-EncodedCommand', encoded])
}

export async function readElementScreenGeometry(selector: string): Promise<ElementScreenGeometry> {
  return browser.execute((targetSelector) => {
    const element = document.querySelector(targetSelector)
    if (!(element instanceof HTMLElement)) throw new Error(`Element not found: ${targetSelector}`)
    const rect = element.getBoundingClientRect()
    const borderX = (window.outerWidth - window.innerWidth) / 2
    const titleBar = window.outerHeight - window.innerHeight - borderX
    return {
      x: Math.round(window.screenX + borderX + rect.left),
      y: Math.round(window.screenY + titleBar + rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  }, selector)
}

export async function nativeDrag(from: ScreenPoint, to: ScreenPoint): Promise<void> {
  const steps = Array.from({ length: 20 }, (_, index) => {
    const progress = (index + 1) / 20
    return {
      x: Math.round(from.x + (to.x - from.x) * progress),
      y: Math.round(from.y + (to.y - from.y) * progress)
    }
  })
  const moves = steps
    .map(
      (point) =>
        `[NativeInput]::SetCursorPos(${point.x}, ${point.y}) | Out-Null\nStart-Sleep -Milliseconds 35`
    )
    .join('\n')
  await runPowerShell(`
Add-Type -TypeDefinition '${USER32_DECLARATION}'
${FOREGROUND_SCRIPT}
[NativeInput]::SetCursorPos(${from.x}, ${from.y}) | Out-Null
Start-Sleep -Milliseconds 100
[NativeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 250
${moves}
Start-Sleep -Milliseconds 250
[NativeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
`)
}
