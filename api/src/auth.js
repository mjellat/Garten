import crypto from 'node:crypto'
import { pool } from './db.js'

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900)
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30)
const SCRYPT_KEY_LENGTH = 64

function requiredSecret(name) {
  const value = process.env[name]
  if (value) return value
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`)
  }
  return `dev-${name.toLowerCase()}`
}

const jwtSecret = requiredSecret('JWT_SECRET')

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function signToken(payload, expiresInSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedBody = base64url(JSON.stringify(body))
  const signature = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest('base64url')

  return `${encodedHeader}.${encodedBody}.${signature}`
}

export function verifyAccessToken(token) {
  const [encodedHeader, encodedBody, signature] = String(token || '').split('.')
  if (!encodedHeader || !encodedBody || !signature) return null

  const expected = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest('base64url')

  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'))
    if (payload.type !== 'access') return null
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url')
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('base64url')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || '').split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false

  const actual = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  const expected = Buffer.from(hash, 'base64url')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

export async function issueTokens(user) {
  const accessToken = signToken({
    type: 'access',
    sub: user.id,
    email: user.email,
  }, ACCESS_TOKEN_TTL_SECONDS)

  const refreshToken = crypto.randomBytes(48).toString('base64url')
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const refreshTokenId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400000)

  await pool.query(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [refreshTokenId, user.id, refreshTokenHash, expiresAt])

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
    },
  }
}

export async function rotateRefreshToken(token) {
  const tokenHash = hashRefreshToken(token)
  const result = await pool.query(`
    SELECT rt.id, rt.user_id, u.email
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = $1
      AND rt.revoked_at IS NULL
      AND rt.expires_at > now()
  `, [tokenHash])

  const row = result.rows[0]
  if (!row) return null

  await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id])
  return issueTokens({ id: row.user_id, email: row.email })
}

export async function revokeRefreshToken(token) {
  const tokenHash = hashRefreshToken(token)
  await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [tokenHash])
}
