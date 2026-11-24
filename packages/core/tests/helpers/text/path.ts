/** A straight horizontal line, in 400x100 normalized space (zero tangents = no curve). */
export function straightLineNetwork() {
  return {
    vertices: [
      { x: 0, y: 50 },
      { x: 400, y: 50 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  }
}
