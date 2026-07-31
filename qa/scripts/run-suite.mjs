import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeTarget } from "./guard-target.mjs";
import { composeSync, qaRoot, repositoryRoot, waitForUrl } from "./compose-helpers.mjs";

const requestedProfile = process.argv[2] || "smoke";
const profiles = requestedProfile === "all" ? ["smoke", "ci", "full"] : [requestedProfile];
for (const profile of profiles) {
  if (!["smoke", "ci", "full", "breakpoint"].includes(profile)) {
    throw new Error(`Unknown QA profile: ${profile}`);
  }
}

const backendUrl = process.env.QA_BACKEND_URL || process.env.QA_TARGET_URL || "http://127.0.0.1:3100";
const uiUrl = process.env.QA_UI_URL || "http://127.0.0.1:5174";
const apiUrl = process.env.QA_API_URL || `${backendUrl}/api`;
assertSafeTarget(backendUrl);
assertSafeTarget(uiUrl);
assertSafeTarget(apiUrl);

const artifacts = path.resolve(qaRoot, "artifacts");
if (!artifacts.startsWith(`${path.resolve(qaRoot)}${path.sep}`)) {
  throw new Error(`Unsafe artifact path: ${artifacts}`);
}
await rm(artifacts, { recursive: true, force: true });
await mkdir(artifacts, { recursive: true });

process.env.QA_EXPENSE_COUNT = profiles.includes("full") ? "100000" : profiles.includes("ci") ? "10000" : "1000";
process.env.QA_BACKEND_URL = backendUrl;
process.env.QA_UI_URL = uiUrl;
process.env.QA_API_URL = apiUrl;

const node = process.execPath;
const playwrightCommand = process.platform === "win32" ? "cmd.exe" : "npx";
const playwrightPrefix = process.platform === "win32" ? ["/d", "/c", "npx"] : [];
const status = {
  startedAt: new Date().toISOString(),
  profiles,
  seed: process.env.QA_SEED || "20260801",
  expenseCount: Number(process.env.QA_EXPENSE_COUNT),
  steps: [],
  result: "RUNNING",
};

function runStep(name, command, args, options = {}) {
  const startedAt = Date.now();
  try {
    execFileSync(command, args, {
      cwd: options.cwd || repositoryRoot,
      env: process.env,
      stdio: "inherit",
    });
    status.steps.push({ name, passed: true, durationMs: Date.now() - startedAt });
  } catch (error) {
    status.steps.push({ name, passed: false, durationMs: Date.now() - startedAt, error: error.message });
    throw error;
  }
}

try {
  composeSync(["config", "--quiet"]);
  composeSync(["down", "--volumes", "--remove-orphans"]);
  composeSync(["up", "--build", "-d", "db", "backend", "frontend"]);
  await waitForUrl(`${backendUrl}/up`, 180_000);
  await waitForUrl(uiUrl, 180_000);

  runStep("database index and EXPLAIN", node, [path.join(qaRoot, "scripts", "verify-database.mjs")]);
  runStep("adversarial API", node, [path.join(qaRoot, "scripts", "adversarial-api.mjs")]);

  if (!profiles.every((profile) => profile === "breakpoint")) {
    runStep("Playwright critical journeys", playwrightCommand, [
      ...playwrightPrefix,
      "playwright",
      "test",
      "--config",
      "playwright.config.mjs",
    ], {
      cwd: qaRoot,
    });
    process.env.QA_RESTART_COUNT = process.env.QA_RESTART_COUNT || (profiles.includes("ci") || profiles.includes("full") ? "25" : "2");
    runStep("backend restart qualification", node, [path.join(qaRoot, "scripts", "restart-backend.mjs")]);
    if (profiles.includes("ci") || profiles.includes("full")) {
      runStep("database fault and recovery", node, [path.join(qaRoot, "scripts", "chaos-recovery.mjs")]);
    }
  }

  for (const profile of profiles) {
    runStep(`k6 ${profile}`, node, [path.join(qaRoot, "scripts", "run-k6.mjs"), profile]);
  }

  status.result = "PASS_WITH_PRODUCTION_BLOCKERS";
} catch (error) {
  status.result = "FAIL";
  status.error = error.message;
  process.exitCode = 1;
} finally {
  status.finishedAt = new Date().toISOString();
  try {
    const logs = composeSync(["logs", "--no-color"], { capture: true });
    await writeFile(path.join(artifacts, "compose.log"), logs);
  } catch (error) {
    status.logCollectionError = error.message;
  }
  await writeFile(path.join(artifacts, "qualification-status.json"), JSON.stringify(status, null, 2));
  if (process.env.QA_KEEP_STACK !== "1") {
    try {
      composeSync(["down", "--volumes", "--remove-orphans"]);
    } catch (error) {
      console.error(`Qualification cleanup failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
  console.log(JSON.stringify(status, null, 2));
}
