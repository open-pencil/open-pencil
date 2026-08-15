import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface ClientPoint {
  x: number
  y: number
}

type ElementClientGeometry = Pick<DOMRect, 'height' | 'width' | 'x' | 'y'>

const USER32_DECLARATION = String.raw`
using System;
using System.Runtime.InteropServices;
public static class NativeInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct Point {
    public int X;
    public int Y;
  }
  [DllImport("user32.dll")]
  public static extern bool ClientToScreen(IntPtr window, ref Point point);
  [DllImport("user32.dll")]
  public static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")]
  public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
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
$process = Get-Process OpenPencil -ErrorAction Stop |
  Where-Object { $_.MainWindowTitle -eq 'OpenPencil Native Test' } |
  Select-Object -First 1
if (-not $process) { throw 'OpenPencil Native Test window not found' }
[NativeInput]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
[NativeInput]::ShowWindow($process.MainWindowHandle, 9) | Out-Null
[NativeInput]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 150
$clientOrigin = New-Object NativeInput+Point
if (-not [NativeInput]::ClientToScreen($process.MainWindowHandle, [ref]$clientOrigin)) {
  throw 'ClientToScreen failed'
}
$dpi = [NativeInput]::GetDpiForWindow($process.MainWindowHandle)
if ($dpi -eq 0) { throw 'GetDpiForWindow failed' }
$scale = $dpi / 96.0
`

async function runPowerShell(script: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('Win32 input is only available on Windows')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  await execFileAsync('powershell.exe', ['-NoProfile', '-EncodedCommand', encoded])
}

export async function readElementClientGeometry(selector: string): Promise<ElementClientGeometry> {
  return browser.execute((targetSelector) => {
    const element = document.querySelector(targetSelector)
    if (!(element instanceof HTMLElement)) throw new Error(`Element not found: ${targetSelector}`)
    const rect = element.getBoundingClientRect()
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    }
  }, selector)
}

export async function nativeDrag(from: ClientPoint, to: ClientPoint): Promise<void> {
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
        `$x = [int][Math]::Round($clientOrigin.X + (${point.x} * $scale))\n$y = [int][Math]::Round($clientOrigin.Y + (${point.y} * $scale))\n[NativeInput]::SetCursorPos($x, $y) | Out-Null\nStart-Sleep -Milliseconds 35`
    )
    .join('\n')
  await runPowerShell(`
Add-Type -TypeDefinition '${USER32_DECLARATION}'
${FOREGROUND_SCRIPT}
$x = [int][Math]::Round($clientOrigin.X + (${from.x} * $scale))
$y = [int][Math]::Round($clientOrigin.Y + (${from.y} * $scale))
[NativeInput]::SetCursorPos($x, $y) | Out-Null
Start-Sleep -Milliseconds 100
[NativeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 250
${moves}
Start-Sleep -Milliseconds 250
[NativeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
`)
}
