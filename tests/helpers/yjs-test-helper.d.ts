declare module 'yjs/testHelper' {
  import type { PRNG } from 'lib0/prng'
  import type * as Y from 'yjs'

  export class TestYInstance extends Y.Doc {
    tc: TestConnector
    updates: Uint8Array[]
    connect(): void
    disconnect(): void
  }

  export class TestConnector {
    constructor(prng: PRNG)
    allConns: Set<TestYInstance>
    onlineConns: Set<TestYInstance>
    createY(clientId: number): TestYInstance
    flushRandomMessage(): boolean
    flushAllMessages(): boolean
    reconnectAll(): void
    disconnectAll(): void
    reconnectRandom(): boolean
    disconnectRandom(): boolean
    syncAll(): void
  }
}
