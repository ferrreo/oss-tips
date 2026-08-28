import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileMigrationProvider, Migrator } from 'kysely';
import { createDb, destroyDb } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const db = createDb(connectionString);
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const command = process.argv[2] ?? 'up';
  const result =
    command === 'down'
      ? await migrator.migrateDown()
      : await migrator.migrateToLatest();

  result.results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  await destroyDb(db);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
