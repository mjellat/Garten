import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool, withTransaction } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(__dirname, '../migrations')

export async function runMigrations() {
  const files = (await readdir(migrationsDir))
    .filter(file => file.endsWith('.sql'))
    .sort()

  await withTransaction(async client => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const appliedResult = await client.query('SELECT filename FROM schema_migrations')
    const applied = new Set(appliedResult.rows.map(row => row.filename))

    for (const file of files) {
      if (applied.has(file)) continue

      const sql = await readFile(path.join(migrationsDir, file), 'utf8')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      console.log(`Applied migration ${file}`)
    }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => pool.end())
    .catch(error => {
      console.error(error)
      pool.end().finally(() => process.exit(1))
    })
}
