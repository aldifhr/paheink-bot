import "dotenv/config";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { redis } from "./lib/redis.js";

const STATIC_KEYS = [
  "pahe:channels:guild-map",
  "pahe:state:cron",
  "pahe:cron:last_run",
];
const NOTIFIED_PATTERN = "pahe:notified:*";
const SCAN_COUNT = 200;

async function collectKeysByPattern(pattern) {
  const keys = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = String(nextCursor);
    keys.push(...batch);
  } while (cursor !== "0");

  return keys;
}

async function collectFlushKeys() {
  const notifiedKeys = await collectKeysByPattern(NOTIFIED_PATTERN);
  return [...new Set([...STATIC_KEYS, ...notifiedKeys])];
}

async function confirmFlush(keys) {
  const rl = createInterface({ input, output });
  try {
    output.write(`About to delete ${keys.length} Redis key(s):\n`);
    for (const key of keys) {
      output.write(`- ${key}\n`);
    }
    const answer = await rl.question("Continue? Type 'yes' to confirm: ");
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

async function deleteKeys(keys) {
  if (!keys.length) {
    return [];
  }

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.del(key);
  }
  return pipeline.exec();
}

function isDeleteResultSuccessful(result) {
  if (typeof result === "number") {
    return result >= 0;
  }

  if (Array.isArray(result)) {
    return result.length > 0 && result[0] !== null && result[0] !== undefined;
  }

  if (result && typeof result === "object") {
    return !result.error;
  }

  return false;
}

function summarizeDeleteResults(results, targetedKeys) {
  if (!Array.isArray(results)) {
    return {
      targetedKeys,
      successfulOps: null,
      rawResultCount: 0,
    };
  }

  return {
    targetedKeys,
    successfulOps: results.filter(isDeleteResultSuccessful).length,
    rawResultCount: results.length,
  };
}

async function main() {
  const keys = await collectFlushKeys();

  if (!keys.length) {
    console.log("No pahe-tracker Redis keys found.");
    return;
  }

  const confirmed = process.argv.includes("--yes") || process.argv.includes("-y")
    ? true
    : await confirmFlush(keys);

  if (!confirmed) {
    console.log("Flush cancelled.");
    process.exitCode = 1;
    return;
  }

  const results = await deleteKeys(keys);
  const summary = summarizeDeleteResults(results, keys.length);

  console.log(`Keys targeted: ${summary.targetedKeys}`);
  if (summary.successfulOps == null) {
    console.log("Delete requests sent, but result format was not recognized.");
    return;
  }

  console.log(`Delete operations acknowledged: ${summary.successfulOps}/${summary.rawResultCount}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
