import { randomIndex } from './random'

/** Figma reads both parts of a GUID as signed 32-bit integers and drops records beyond them. */
const MAX_ID_SESSION = 0x7fffffff

/** Sessions 0 and 1 hold FIG's document and internal-resource records and counter GUIDs. */
const FIRST_RANDOM_SESSION = 2

/** A random session, as Yjs picks each document's `clientID`, so processes never share IDs. */
function randomIdSession(): number {
  return FIRST_RANDOM_SESSION + randomIndex(MAX_ID_SESSION - FIRST_RANDOM_SESSION + 1)
}

let idSession = randomIdSession()
let nextLocalID = 1

/**
 * Sets the session part of the IDs this process mints, as in Figma's `sessionID:localID` GUIDs.
 * Every process starts in a random session, so layers that the editor, the CLI, or MCP add to
 * copies of one file never share IDs. Tests and fixtures that need the same IDs on every run
 * set a fixed session or give the graph its own generator. Returns the previous session.
 */
export function setIdSession(sessionId: number): number {
  if (!Number.isInteger(sessionId) || sessionId < 0 || sessionId > MAX_ID_SESSION) {
    throw new RangeError('sessionId must be a non-negative 31-bit integer')
  }
  const previous = idSession
  idSession = sessionId
  return previous
}

export function generateId(): string {
  return `${idSession}:${nextLocalID++}`
}
