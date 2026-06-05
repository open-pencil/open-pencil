import { expect, type Page } from '@playwright/test'

function parseCookie(cookieHeader: string) {
  const [nameValue, ...attributes] = cookieHeader.split(';').map((part) => part.trim())
  const [name, ...valueParts] = nameValue.split('=')
  const value = valueParts.join('=')

  let domain = 'localhost'
  let path = '/'
  let expires: number | undefined
  let httpOnly = false
  let secure = false
  let sameSite: 'Lax' | 'Strict' | 'None' = 'Lax'

  for (const attribute of attributes) {
    const [rawKey, ...rawValueParts] = attribute.split('=')
    const key = rawKey.toLowerCase()
    const attributeValue = rawValueParts.join('=')

    if (key === 'domain' && attributeValue) domain = attributeValue
    if (key === 'path' && attributeValue) path = attributeValue
    if (key === 'expires' && attributeValue) {
      expires = Math.floor(new Date(attributeValue).getTime() / 1000)
    }
    if (key === 'httponly') httpOnly = true
    if (key === 'secure') secure = true
    if (
      key === 'samesite' &&
      (attributeValue === 'Lax' || attributeValue === 'Strict' || attributeValue === 'None')
    ) {
      sameSite = attributeValue
    }
  }

  return {
    name,
    value,
    domain,
    path,
    expires,
    httpOnly,
    secure,
    sameSite
  } as const
}

export async function mockGoogleLogin(
  page: Page,
  input: {
    email: string
    name: string
  }
) {
  const response = await page.request.post('/api/auth/test/login', {
    data: input
  })

  expect(response.ok()).toBeTruthy()

  const cookieHeader = response
    .headersArray()
    .find((header) => header.name.toLowerCase() === 'set-cookie')?.value

  expect(cookieHeader).toBeTruthy()
  const cookie = parseCookie(cookieHeader ?? '')
  await page.context().addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      url: 'http://localhost:1420',
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite
    }
  ])
}
