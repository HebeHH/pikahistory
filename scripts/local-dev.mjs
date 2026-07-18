import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://history_wall:history_wall@127.0.0.1:54329/history_wall";
const databaseUrl =
  process.env.LOCAL_DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;
const command = process.argv[2] || "dev";
const childEnvironment = { ...process.env, DATABASE_URL: databaseUrl };

function run(program, args) {
  const result = spawnSync(program, args, {
    cwd: process.cwd(),
    env: childEnvironment,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function dockerIsReady() {
  const result = spawnSync("docker", ["info"], { stdio: "ignore" });
  return result.status === 0;
}

async function ensureDockerIsReady() {
  if (dockerIsReady()) {
    return;
  }

  if (process.platform === "darwin") {
    console.log("Docker is stopped; opening Docker Desktop…");
    spawnSync("open", ["-a", "Docker"], { stdio: "ignore" });

    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (dockerIsReady()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.error(
    "\nDocker Desktop is not running. Start Docker Desktop, then run `pnpm dev` again.\n",
  );
  process.exit(1);
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "db",
        "pg_isready",
        "-U",
        "history_wall",
        "-d",
        "history_wall",
      ],
      { stdio: "ignore" },
    );

    if (result.status === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Local PostgreSQL did not become ready within 30 seconds.");
}

async function seedBaseData() {
  // Keep the raw SQL seed path, but validate it against the same contract used
  // by API writes before anything reaches PostgreSQL.
  run("pnpm", ["validate:data"]);

  const source = JSON.parse(
    await readFile("public/data/history-wall.base.json", "utf8"),
  );
  const records = [
    ...source.civilizations,
    ...source.people,
    ...source.events,
    ...source.eras,
  ];
  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    // Civilizations are first so person/event/era references are always valid.
    for (const record of records) {
      const civilizationId =
        record.type === "event" || record.type === "era"
          ? (record.civilizationId ?? null)
          : null;

      await sql`
        insert into history_records (
          id,
          type,
          schema_version,
          title,
          start_year,
          end_year,
          civilization_id,
          payload
        ) values (
          ${record.id},
          ${record.type},
          ${source.schemaVersion},
          ${record.title},
          ${record.span.startYear},
          ${record.span.endYear ?? null},
          ${civilizationId},
          ${sql.json(record)}
        )
        on conflict (id) do nothing
      `;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function prepareLocalDatabase() {
  await ensureDockerIsReady();

  console.log("Starting local PostgreSQL…");
  run("docker", ["compose", "up", "--detach", "db"]);
  await waitForPostgres();

  console.log("Applying the Drizzle schema…");
  run("pnpm", ["exec", "drizzle-kit", "push", "--force"]);

  console.log("Seeding missing base records…");
  await seedBaseData();
  console.log("Local PostgreSQL is ready.\n");
}

if (command === "url") {
  console.log(databaseUrl);
  process.exit(0);
}

if (command === "down") {
  run("docker", ["compose", "down"]);
  process.exit(0);
}

if (command !== "up" && command !== "dev") {
  console.error(`Unknown local database command: ${command}`);
  process.exit(1);
}

await prepareLocalDatabase();

if (command === "up") {
  process.exit(0);
}

const next = spawn("pnpm", ["exec", "next", "dev"], {
  cwd: process.cwd(),
  env: childEnvironment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}

next.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
