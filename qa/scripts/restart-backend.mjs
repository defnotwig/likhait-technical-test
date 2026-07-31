import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { composeSync, qaRoot, waitForUrl } from "./compose-helpers.mjs";

const iterations = Number(process.env.QA_RESTART_COUNT || "25");
const backendUrl = process.env.QA_BACKEND_URL || "http://127.0.0.1:3100";
const evidence = [];

for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const startedAt = Date.now();
  composeSync(["up", "-d", "--force-recreate", "backend"]);
  await waitForUrl(`${backendUrl}/up`, 45_000);
  const durationMs = Date.now() - startedAt;
  const status = composeSync(["ps", "--status", "running", "--format", "json", "backend"], {
    capture: true,
  });
  if (!status.trim()) throw new Error(`Backend was not running after restart ${iteration}`);
  evidence.push({ iteration, durationMs });
  console.log(`restart ${iteration}/${iterations}: ${durationMs}ms`);
}

const artifacts = path.join(qaRoot, "artifacts");
await mkdir(artifacts, { recursive: true });
await writeFile(
  path.join(artifacts, "backend-restarts.json"),
  JSON.stringify({ iterations, backendUrl, evidence }, null, 2),
);
