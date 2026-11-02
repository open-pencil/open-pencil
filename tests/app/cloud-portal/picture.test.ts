import { describe, expect, test } from 'bun:test'

import {
  centredCrop,
  clampCrop,
  cropRegion,
  PICTURE_MAX_ZOOM,
  zoomCrop
} from '@/app/cloud-portal/picture'

const FRAME = 240
const LANDSCAPE = { width: 800, height: 400 }

describe('picture crop', () => {
  test('starts centred with the shorter side filling the frame', () => {
    const crop = centredCrop(LANDSCAPE, FRAME)
    expect(crop).toEqual({ zoom: 1, x: -120, y: 0 })
    expect(cropRegion(LANDSCAPE, FRAME, crop)).toEqual({ x: 200, y: 0, size: 400 })
  })

  test('never leaves a gap in the frame', () => {
    expect(clampCrop(LANDSCAPE, FRAME, { zoom: 1, x: 50, y: 30 })).toEqual({ zoom: 1, x: 0, y: 0 })
    expect(clampCrop(LANDSCAPE, FRAME, { zoom: 1, x: -1000, y: -30 })).toEqual({
      zoom: 1,
      x: -240,
      y: 0
    })
    expect(clampCrop(LANDSCAPE, FRAME, { zoom: 9, x: 0, y: 0 }).zoom).toBe(PICTURE_MAX_ZOOM)
  })

  test('zooms around the middle of the frame', () => {
    const zoomed = zoomCrop(LANDSCAPE, FRAME, centredCrop(LANDSCAPE, FRAME), 2)
    expect(zoomed).toEqual({ zoom: 2, x: -360, y: -120 })
    const region = cropRegion(LANDSCAPE, FRAME, zoomed)
    expect(region.x + region.size / 2).toBe(400)
    expect(region.y + region.size / 2).toBe(200)
    expect(region.size).toBe(200)
  })
})
