import { readFile } from "node:fs/promises";

import { HistoryWallDataSchema } from "../src/contracts/history-wall.schema";

async function main() {
  const input = JSON.parse(
    await readFile("public/data/history-wall.base.json", "utf8"),
  ) as unknown;

  HistoryWallDataSchema.parse(input);
}

void main();
