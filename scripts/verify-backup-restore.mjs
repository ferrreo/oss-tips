#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sourceUrl = process.env.DATABASE_URL?.trim();
if (!sourceUrl) throw new Error('DATABASE_URL is required');
if (process.env.BACKUP_RESTORE_CONFIRM !== 'disposable') {
  throw new Error(
    'Set BACKUP_RESTORE_CONFIRM=disposable and point DATABASE_URL at a disposable restore source',
  );
}

function targetUrl(raw, database) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }
  url.pathname = `/${database}`;
  return url.toString();
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`));
      }
    });
  });
}

const database = `oss_tips_backup_check_${process.pid}_${Date.now()}`;
const restoreUrl = targetUrl(sourceUrl, database);
const workdir = await mkdtemp(join(tmpdir(), 'oss-tips-backup-'));
const archive = join(workdir, 'database.dump');
const restoreSql = join(workdir, 'restore.sql');
let created = false;

try {
  await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', archive, sourceUrl]);
  await run('createdb', ['--maintenance-db', sourceUrl, database]);
  created = true;
  await run('pg_restore', ['--no-owner', '--no-acl', '--file', restoreSql, archive]);
  // pg_dump 17+ emits this setting, which PostgreSQL 16 does not know.
  const sql = await readFile(restoreSql, 'utf8');
  await writeFile(restoreSql, sql.replace(/^SET transaction_timeout = 0;\n/m, ''));
  await run('psql', [
    '--no-psqlrc',
    '--single-transaction',
    '--set=ON_ERROR_STOP=1',
    '--dbname',
    restoreUrl,
    '--file',
    restoreSql,
  ]);
  const result = await run('psql', [
    '--no-psqlrc',
    '--dbname',
    restoreUrl,
    '--tuples-only',
    '--no-align',
    '--set=ON_ERROR_STOP=1',
    '--command',
    "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('project', 'payment', 'audit_event')",
  ]);
  const tableCount = Number(result.stdout.trim());
  if (!Number.isInteger(tableCount) || tableCount < 3) {
    throw new Error(`restore verification found ${result.stdout.trim() || 'no'} required tables`);
  }
  console.log(`Backup/restore verification passed (${tableCount} required tables restored)`);
} finally {
  if (created) {
    await run('dropdb', ['--if-exists', '--maintenance-db', sourceUrl, database]);
  }
  await rm(workdir, { recursive: true, force: true });
}
