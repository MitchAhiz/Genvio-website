// Applies any pending migration in prisma/migrations through the runtime
// Prisma client and records it in _prisma_migrations.
//
// Why this exists: Supabase's transaction pooler (port 6543) rejects Prisma's
// schema engine, so `prisma migrate deploy` cannot run against it. The runtime
// client connects fine, so this script replays the SQL files instead.
//
//   npm run db:apply
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations')
const prisma = new PrismaClient()

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function main() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  )`)

  const recorded = new Set(
    (await prisma.$queryRawUnsafe('SELECT migration_name FROM _prisma_migrations')).map((r) => r.migration_name)
  )

  const dirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  let applied = 0
  for (const name of dirs) {
    if (recorded.has(name)) continue
    const file = path.join(MIGRATIONS_DIR, name, 'migration.sql')
    if (!fs.existsSync(file)) continue
    const sql = fs.readFileSync(file, 'utf8')
    const statements = splitStatements(sql)
    console.log(`applying ${name} (${statements.length} statements)`)
    for (const st of statements) await prisma.$executeRawUnsafe(st)
    const checksum = crypto.createHash('sha256').update(sql).digest('hex')
    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), $3)`,
      checksum,
      name,
      statements.length
    )
    applied++
  }
  console.log(applied ? `done: ${applied} migration(s) applied` : 'nothing to apply — database is up to date')
}

main()
  .catch((err) => {
    console.error('FAILED:', err.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
