/** JSON as values: what `JSON.parse` can give and `JSON.stringify` can write. */
export type JSONPrimitive = string | number | boolean | null
export type JSONValue = JSONPrimitive | JSONObject | JSONArray
export type JSONObject = { [key: string]: unknown }
export type JSONArray = unknown[]
