import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { composeSync, qaRoot } from "./compose-helpers.mjs";
import { assertSafeTarget } from "./guard-target.mjs";

const apiUrl = (process.env.QA_API_URL || "http://127.0.0.1:3100/api").replace(/\/+$/, "");
assertSafeTarget(apiUrl);
const evidence = { apiUrl, startedAt: new Date().toISOString(), events: [] };

async function jsonRequest(pathname, options = {}, timeoutMs = 10_000) {
  const response = await fetch(`${apiUrl}${pathname}`, {
    signal: AbortSignal.timeout(timeoutMs),
    ...options,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function waitForDatabaseRecovery(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await jsonRequest("/categories", {}, 3_000);
      if (response.status === 200) return Date.now();
    } catch {
      // Recovery polling deliberately tolerates the injected outage.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("API did not recover database access within 30 seconds");
}

const categories = await jsonRequest("/categories");
const food = categories.body.find(({ name }) => name === "Food");
const before = await jsonRequest("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expense: {
      amount: 7,
      description: `QA-CHAOS-${Date.now()}`,
      category_id: food.id,
      date: new Date().toISOString().slice(0, 10),
    },
  }),
});
if (before.status !== 201) throw new Error(`Chaos fixture create failed with ${before.status}`);

composeSync(["pause", "db"]);
const pauseStarted = Date.now();
try {
  const duringPause = await jsonRequest("/categories", {}, 5_000);
  evidence.events.push({ event: "database_paused_request", status: duringPause.status });
} catch (error) {
  evidence.events.push({ event: "database_paused_request", error: error.name });
} finally {
  composeSync(["unpause", "db"]);
}
const pauseRecoveredAt = await waitForDatabaseRecovery();
evidence.events.push({ event: "database_pause_recovery", durationMs: pauseRecoveredAt - pauseStarted });

const restartStarted = Date.now();
composeSync(["restart", "db"]);
const restartRecoveredAt = await waitForDatabaseRecovery();
evidence.events.push({ event: "database_restart_recovery", durationMs: restartRecoveredAt - restartStarted });

const after = await jsonRequest("/expenses");
if (!after.body.some(({ id }) => id === before.body.id)) {
  throw new Error("Chaos fixture disappeared after database recovery");
}

const deleted = await jsonRequest(`/expenses/${before.body.id}`, { method: "DELETE" });
if (deleted.status !== 204) throw new Error(`Chaos fixture cleanup failed with ${deleted.status}`);

evidence.finishedAt = new Date().toISOString();
const artifacts = path.join(qaRoot, "artifacts");
await mkdir(artifacts, { recursive: true });
await writeFile(path.join(artifacts, "chaos-recovery.json"), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
