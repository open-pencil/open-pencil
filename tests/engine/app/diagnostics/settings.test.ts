import { describe, expect, test } from 'bun:test'

import {
  DIAGNOSTICS_RETENTION_DEFAULT,
  DIAGNOSTICS_RETENTION_MAX,
  DIAGNOSTICS_RETENTION_MIN,
  diagnosticsRetentionPresets,
  resolveDiagnosticsRetention
} from '@/app/diagnostics/settings'

describe('diagnostics retention', () => {
  test('keeps offered presets', () => {
    for (const preset of diagnosticsRetentionPresets) {
      expect(resolveDiagnosticsRetention(preset)).toBe(preset)
      expect(resolveDiagnosticsRetention(String(preset))).toBe(preset)
    }
  })

  test('accepts custom values inside the supported range', () => {
    expect(resolveDiagnosticsRetention(750)).toBe(750)
    expect(resolveDiagnosticsRetention('1234')).toBe(1234)
    expect(resolveDiagnosticsRetention(DIAGNOSTICS_RETENTION_MIN)).toBe(DIAGNOSTICS_RETENTION_MIN)
    expect(resolveDiagnosticsRetention(DIAGNOSTICS_RETENTION_MAX)).toBe(DIAGNOSTICS_RETENTION_MAX)
  })

  test('clamps out-of-range values instead of storing them', () => {
    expect(resolveDiagnosticsRetention(0)).toBe(DIAGNOSTICS_RETENTION_MIN)
    expect(resolveDiagnosticsRetention(-100)).toBe(DIAGNOSTICS_RETENTION_MIN)
    expect(resolveDiagnosticsRetention(1_000_000)).toBe(DIAGNOSTICS_RETENTION_MAX)
  })

  test('falls back to the default for unusable stored values', () => {
    for (const value of [undefined, null, '', 'many', Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      expect(resolveDiagnosticsRetention(value)).toBe(DIAGNOSTICS_RETENTION_DEFAULT)
    }
  })

  test('rounds fractional values', () => {
    expect(resolveDiagnosticsRetention(750.4)).toBe(750)
    expect(resolveDiagnosticsRetention(750.6)).toBe(751)
  })
})
