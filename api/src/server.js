import crypto from 'node:crypto'
import http from 'node:http'
import { pool, withTransaction } from './db.js'
import {
  hashPassword,
  issueTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
  verifyPassword,
} from './auth.js'
import { runMigrations } from './migrate.js'

const PORT = Number(process.env.PORT || 3000)
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1024 * 1024)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function sendJson(response, status, payload = null) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(payload === null ? '' : JSON.stringify(payload))
}

function sendError(response, status, message) {
  sendJson(response, status, { message })
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function formatDate(value) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function formatTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large')
      error.status = 413
      throw error
    }
  }

  if (!body) return {}

  try {
    return JSON.parse(body)
  } catch {
    const error = new Error('Invalid JSON body')
    error.status = 400
    throw error
  }
}

async function requireUser(request, response) {
  const authorization = request.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const payload = verifyAccessToken(token)

  if (!payload?.sub) {
    sendError(response, 401, 'Authentication required')
    return null
  }

  return {
    id: payload.sub,
    email: payload.email,
  }
}

function validateEntries(entries) {
  if (!Array.isArray(entries)) {
    const error = new Error('entries must be an array')
    error.status = 400
    throw error
  }

  if (entries.length > 500) {
    const error = new Error('A plan can contain at most 500 entries')
    error.status = 400
    throw error
  }

  const seen = new Set()

  return entries.map((entry, index) => {
    const id = String(entry?.id || '').trim()
    const plantId = String(entry?.plantId || '').trim()
    const varietyId = entry?.varietyId ? String(entry.varietyId).trim() : null
    const actualSowingDate = entry?.actualSowingDate ? String(entry.actualSowingDate).trim() : null

    if (!id || id.length > 120) {
      const error = new Error(`entries[${index}].id is invalid`)
      error.status = 400
      throw error
    }

    if (seen.has(id)) {
      const error = new Error(`Duplicate entry id ${id}`)
      error.status = 400
      throw error
    }

    if (!plantId || plantId.length > 80) {
      const error = new Error(`entries[${index}].plantId is invalid`)
      error.status = 400
      throw error
    }

    if (varietyId && varietyId.length > 120) {
      const error = new Error(`entries[${index}].varietyId is invalid`)
      error.status = 400
      throw error
    }

    if (actualSowingDate && !DATE_PATTERN.test(actualSowingDate)) {
      const error = new Error(`entries[${index}].actualSowingDate must be YYYY-MM-DD`)
      error.status = 400
      throw error
    }

    seen.add(id)

    return {
      id,
      plantId,
      varietyId,
      actualSowingDate,
      sortOrder: index,
    }
  })
}

async function loadPlan(db, userId, year) {
  const planResult = await db.query(`
    SELECT id, year, revision, updated_at
    FROM garden_plans
    WHERE user_id = $1 AND year = $2
  `, [userId, year])

  const plan = planResult.rows[0]
  if (!plan) {
    return {
      id: null,
      year,
      revision: 0,
      updatedAt: null,
      entries: [],
    }
  }

  const entriesResult = await db.query(`
    SELECT id, plant_id, variety_id, actual_sowing_date, sort_order, revision, updated_at
    FROM garden_entries
    WHERE plan_id = $1 AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `, [plan.id])

  return {
    id: plan.id,
    year: plan.year,
    revision: plan.revision,
    updatedAt: formatTimestamp(plan.updated_at),
    entries: entriesResult.rows.map(row => ({
      id: row.id,
      plantId: row.plant_id,
      varietyId: row.variety_id,
      actualSowingDate: formatDate(row.actual_sowing_date),
      sortOrder: row.sort_order,
      revision: row.revision,
      updatedAt: formatTimestamp(row.updated_at),
    })),
  }
}

async function handleRegister(request, response) {
  const body = await readJsonBody(request)
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')

  if (!EMAIL_PATTERN.test(email)) {
    sendError(response, 400, 'Bitte eine gültige E-Mail-Adresse eingeben')
    return
  }

  if (password.length < 8) {
    sendError(response, 400, 'Das Passwort muss mindestens 8 Zeichen haben')
    return
  }

  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash: hashPassword(password),
  }

  try {
    await pool.query(`
      INSERT INTO users (id, email, password_hash)
      VALUES ($1, $2, $3)
    `, [user.id, user.email, user.passwordHash])
  } catch (error) {
    if (error.code === '23505') {
      sendError(response, 409, 'Diese E-Mail-Adresse ist bereits registriert')
      return
    }
    throw error
  }

  sendJson(response, 201, await issueTokens(user))
}

async function handleLogin(request, response) {
  const body = await readJsonBody(request)
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')

  const result = await pool.query(`
    SELECT id, email, password_hash
    FROM users
    WHERE email = $1
  `, [email])

  const user = result.rows[0]
  if (!user || !verifyPassword(password, user.password_hash)) {
    sendError(response, 401, 'E-Mail oder Passwort ist falsch')
    return
  }

  sendJson(response, 200, await issueTokens(user))
}

async function handleRefresh(request, response) {
  const body = await readJsonBody(request)
  const tokens = await rotateRefreshToken(String(body.refreshToken || ''))

  if (!tokens) {
    sendError(response, 401, 'Session abgelaufen')
    return
  }

  sendJson(response, 200, tokens)
}

async function handleLogout(request, response) {
  const body = await readJsonBody(request)
  await revokeRefreshToken(String(body.refreshToken || ''))
  sendJson(response, 204)
}

async function handleMe(request, response) {
  const user = await requireUser(request, response)
  if (!user) return

  sendJson(response, 200, { user })
}

async function handleGetPlan(request, response, year) {
  const user = await requireUser(request, response)
  if (!user) return

  const plan = await loadPlan(pool, user.id, year)
  sendJson(response, 200, { plan })
}

async function handleSyncPlan(request, response, year) {
  const user = await requireUser(request, response)
  if (!user) return

  const body = await readJsonBody(request)
  const baseRevision = Number(body.baseRevision || 0)
  const entries = validateEntries(body.entries)

  const result = await withTransaction(async client => {
    let planResult = await client.query(`
      SELECT id, revision
      FROM garden_plans
      WHERE user_id = $1 AND year = $2
      FOR UPDATE
    `, [user.id, year])

    let plan = planResult.rows[0]
    if (!plan) {
      const planId = crypto.randomUUID()
      planResult = await client.query(`
        INSERT INTO garden_plans (id, user_id, year, revision)
        VALUES ($1, $2, $3, 0)
        RETURNING id, revision
      `, [planId, user.id, year])
      plan = planResult.rows[0]
    }

    if (Number(plan.revision) !== baseRevision) {
      return {
        conflict: true,
        plan: await loadPlan(client, user.id, year),
      }
    }

    if (entries.length === 0) {
      await client.query(`
        UPDATE garden_entries
        SET deleted_at = now(), updated_at = now(), revision = revision + 1
        WHERE plan_id = $1 AND deleted_at IS NULL
      `, [plan.id])
    } else {
      await client.query(`
        UPDATE garden_entries
        SET deleted_at = now(), updated_at = now(), revision = revision + 1
        WHERE plan_id = $1 AND deleted_at IS NULL AND NOT (id = ANY($2::text[]))
      `, [plan.id, entries.map(entry => entry.id)])
    }

    for (const entry of entries) {
      await client.query(`
        INSERT INTO garden_entries (
          id, plan_id, plant_id, variety_id, actual_sowing_date, sort_order, revision, deleted_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 1, NULL, now())
        ON CONFLICT (plan_id, id) DO UPDATE SET
          plant_id = EXCLUDED.plant_id,
          variety_id = EXCLUDED.variety_id,
          actual_sowing_date = EXCLUDED.actual_sowing_date,
          sort_order = EXCLUDED.sort_order,
          deleted_at = NULL,
          updated_at = now(),
          revision = garden_entries.revision + 1
      `, [
        entry.id,
        plan.id,
        entry.plantId,
        entry.varietyId,
        entry.actualSowingDate,
        entry.sortOrder,
      ])
    }

    await client.query(`
      UPDATE garden_plans
      SET revision = revision + 1, updated_at = now()
      WHERE id = $1
    `, [plan.id])

    return {
      conflict: false,
      plan: await loadPlan(client, user.id, year),
    }
  })

  if (result.conflict) {
    sendJson(response, 409, {
      message: 'Plan wurde auf einem anderen Gerät geändert',
      plan: result.plan,
    })
    return
  }

  sendJson(response, 200, { plan: result.plan })
}

function parsePlanYear(pathname) {
  const match = pathname.match(/^\/api\/plans\/(\d{4})(?:\/sync)?$/)
  if (!match) return null

  const year = Number(match[1])
  if (year < 2024 || year > 2040) return null
  return year
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`)
  const { pathname } = url

  if (request.method === 'GET' && pathname === '/api/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'POST' && pathname === '/api/auth/register') {
    await handleRegister(request, response)
    return
  }

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    await handleLogin(request, response)
    return
  }

  if (request.method === 'POST' && pathname === '/api/auth/refresh') {
    await handleRefresh(request, response)
    return
  }

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    await handleLogout(request, response)
    return
  }

  if (request.method === 'GET' && pathname === '/api/me') {
    await handleMe(request, response)
    return
  }

  const year = parsePlanYear(pathname)
  if (year && request.method === 'GET' && pathname === `/api/plans/${year}`) {
    await handleGetPlan(request, response, year)
    return
  }

  if (year && request.method === 'POST' && pathname === `/api/plans/${year}/sync`) {
    await handleSyncPlan(request, response, year)
    return
  }

  sendError(response, 404, 'Not found')
}

const server = http.createServer((request, response) => {
  route(request, response).catch(error => {
    console.error(error)
    sendError(response, error.status || 500, error.status ? error.message : 'Internal server error')
  })
})

runMigrations()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Garten API listening on ${PORT}`)
    })
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
