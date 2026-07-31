import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const qaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repositoryRoot = path.resolve(qaRoot, "..");
export const composeFile = path.join(qaRoot, "docker-compose.qualification.yml");
export const projectName = process.env.QA_PROJECT_NAME || `likhait_qa_${process.env.QA_SEED || "20260801"}`;

if (!/^likhait_qa_[a-zA-Z0-9_-]+$/.test(projectName)) {
  throw new Error(`Unsafe Compose project name: ${projectName}`);
}

export function composeArgs(...args) {
  return ["compose", "-p", projectName, "-f", composeFile, ...args];
}

export function composeSync(args, options = {}) {
  return execFileSync("docker", composeArgs(...args), {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...options,
  });
}

export function composeSpawn(args, options = {}) {
  return spawn("docker", composeArgs(...args), {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
}

export async function waitForUrl(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(requestTimeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "unknown error"}`);
}
