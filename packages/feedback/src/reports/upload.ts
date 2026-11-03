import { reportFileNameSchema, type ReportFile } from '#feedback/contract'
import { jwtVerify, SignJWT } from 'jose'
import * as v from 'valibot'

/** Long enough for a slow connection to upload the largest file, short enough to be useless later. */
export const UPLOAD_TOKEN_TTL_SECONDS = 60 * 60

const ISSUER = 'feedback.openpencil.dev'
const AUDIENCE = 'report-upload'

const claimsSchema = v.object({
  sub: v.pipe(v.string(), v.uuid()),
  files: v.array(v.object({ name: reportFileNameSchema, size: v.number() }))
})

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

/** A token that lets the report's sender upload exactly the files, and sizes, it declared. */
export async function signUploadToken(
  secret: string,
  reportId: string,
  files: ReportFile[],
  now: Date
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000)
  return new SignJWT({ files })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(reportId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + UPLOAD_TOKEN_TTL_SECONDS)
    .sign(key(secret))
}

/** The file a token allows under `name` for `reportId`, or null for any other token or file. */
export async function allowedUpload(
  secret: string,
  token: string,
  reportId: string,
  name: string,
  now: Date
): Promise<ReportFile | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
      requiredClaims: ['exp'],
      currentDate: now
    })
    const claims = v.parse(claimsSchema, payload)
    if (claims.sub !== reportId) return null
    return claims.files.find((file) => file.name === name) ?? null
  } catch {
    return null
  }
}
