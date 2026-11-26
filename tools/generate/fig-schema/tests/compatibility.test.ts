import { expect, test } from 'bun:test'

import { additions, incompatibleChanges } from '#fig-schema/compatibility'

import { parseSchema } from '@open-pencil/kiwi/schema-runtime'

const CURRENT = parseSchema(`
enum Kind {
  A = 0;
}

struct Point {
  float x;
  float y;
}

message Shape {
  Kind kind = 1;
  Point[] points = 2;
}
`)

test('an update that only adds definitions, fields and enum values breaks nothing', () => {
  const next = parseSchema(`
enum Kind {
  A = 0;
  B = 1;
}

struct Point {
  float x;
  float y;
}

message Shape {
  Kind kind = 1;
  Point[] points = 2;
  string label = 3;
}

message Group {
  Shape[] shapes = 1;
}
`)
  expect(incompatibleChanges(CURRENT, next)).toEqual([])
  expect(additions(CURRENT, next)).toEqual({
    definitions: ['Group'],
    fields: ['Kind.B', 'Shape.label']
  })
})

test('a new enum member on a value already in use is refused', () => {
  const next = parseSchema(`
enum Kind {
  A = 0;
  B = 0;
}

struct Point {
  float x;
  float y;
}

message Shape {
  Kind kind = 1;
  Point[] points = 2;
}
`)
  expect(incompatibleChanges(CURRENT, next)).toEqual(['Kind 0 would read as B instead of A'])
})

test('reordering existing enum aliases is refused, since it renames the value they share', () => {
  const current = parseSchema('enum Kind {\n  A = 0;\n  B = 1;\n  C = 1;\n}\n')
  const next = parseSchema('enum Kind {\n  A = 0;\n  C = 1;\n  B = 1;\n}\n')
  expect(incompatibleChanges(current, next)).toEqual(['Kind 1 would read as B instead of C'])
})

test('an update that removes, renumbers or retypes anything is refused, naming each change', () => {
  const next = parseSchema(`
enum Kind {
  A = 1;
}

struct Point {
  float x;
  float y;
  float z;
}

message Shape {
  Kind[] kind = 1;
}
`)
  expect(incompatibleChanges(CURRENT, next)).toEqual([
    'Kind.A changed from = 0 to = 1',
    'Point changed its struct fields',
    'Shape.kind changed from Kind = 1 to Kind[] = 1',
    'Shape.points was removed'
  ])
})
