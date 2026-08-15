export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
