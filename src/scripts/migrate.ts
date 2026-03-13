import dotenv from "dotenv";
import sequelize from "../config/db.config";
import { migrations } from "../migrations";

dotenv.config();

const MIGRATIONS_TABLE = "schema_migrations";

type MigrationRow = {
  id: string;
  name: string;
  appliedAt: Date;
};

const migrationById = new Map(migrations.map((migration) => [migration.id, migration]));

const ensureMigrationsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL,
      \`appliedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const getAppliedMigrationRows = async (): Promise<MigrationRow[]> => {
  const [rows] = await sequelize.query(
    `SELECT id, name, appliedAt FROM \`${MIGRATIONS_TABLE}\` ORDER BY appliedAt ASC, id ASC`,
  );

  return rows as MigrationRow[];
};

const getAppliedMigrationIds = async (): Promise<Set<string>> => {
  const rows = await getAppliedMigrationRows();
  return new Set(rows.map((row) => row.id));
};

const printStatus = async () => {
  const applied = await getAppliedMigrationIds();

  console.log("Migration status:");
  for (const migration of migrations) {
    const status = applied.has(migration.id) ? "APPLIED" : "PENDING";
    console.log(`- ${migration.id} :: ${status} :: ${migration.name}`);
  }
};

const applyMigrations = async () => {
  const applied = await getAppliedMigrationIds();

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    await sequelize.transaction(async (transaction) => {
      const queryInterface = sequelize.getQueryInterface();

      await migration.up(queryInterface, transaction);

      await sequelize.query(
        `INSERT INTO \`${MIGRATIONS_TABLE}\` (id, name) VALUES (:id, :name)`,
        {
          replacements: {
            id: migration.id,
            name: migration.name,
          },
          transaction,
        },
      );
    });

    console.log(`Applied migration: ${migration.id}`);
  }

  console.log("All migrations are up to date.");
};

const rollbackMigrations = async (steps = 1) => {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error("Rollback steps must be a positive integer.");
  }

  const appliedRows = await getAppliedMigrationRows();
  if (appliedRows.length === 0) {
    console.log("No applied migrations to roll back.");
    return;
  }

  const knownAppliedRows = appliedRows.filter((row) => migrationById.has(row.id));
  if (knownAppliedRows.length === 0) {
    throw new Error("No known applied migrations were found.");
  }

  const targets = knownAppliedRows.slice(-steps).reverse();

  for (const row of targets) {
    const migration = migrationById.get(row.id);
    if (!migration) {
      throw new Error(`Migration ${row.id} is not registered in code.`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${migration.id} does not define a down handler.`);
    }

    await sequelize.transaction(async (transaction) => {
      const queryInterface = sequelize.getQueryInterface();

      await migration.down!(queryInterface, transaction);

      await sequelize.query(`DELETE FROM \`${MIGRATIONS_TABLE}\` WHERE id = :id`, {
        replacements: { id: migration.id },
        transaction,
      });
    });

    console.log(`Rolled back migration: ${migration.id}`);
  }

  console.log(`Rollback complete. Rolled back ${targets.length} migration(s).`);
};

const main = async () => {
  const command = (process.argv[2] ?? "up").toLowerCase();

  await sequelize.authenticate();
  await ensureMigrationsTable();

  if (command === "status") {
    await printStatus();
  } else if (command === "up") {
    await applyMigrations();
  } else if (command === "down") {
    const stepsArg = process.argv[3];
    const steps = stepsArg ? Number(stepsArg) : 1;
    await rollbackMigrations(steps);
  } else {
    throw new Error(`Unknown command '${command}'. Use 'up', 'down', or 'status'.`);
  }

  await sequelize.close();
};

main().catch(async (error) => {
  console.error("Migration failed:", error);
  try {
    await sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
