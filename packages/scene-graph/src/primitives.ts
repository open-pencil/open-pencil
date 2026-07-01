export interface GUID {
  sessionID: number
  localID: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface Vector {
  x: number
  y: number
}

export interface Matrix {
  m00: number
  m01: number
  m02: number
  m10: number
  m11: number
  m12: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export type JsonObject = { [key: string]: unknown }
export type JsonArray = unknown[]
