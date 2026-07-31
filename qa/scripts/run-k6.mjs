import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { composeArgs, composeSpawn, composeSync, qaRoot } from "./compose-helpers.mjs";

const profile = process.argv[2] || process.env.QA_PROFILE || "ci";
const repetitions = profile === "ci" ? 3 : 1;
const samples = [];
let completedRepetitions = 0;
const artifactDirectory = path.join(qaRoot, "artifacts");
await mkdir(artifactDirectory, { recursive: true });

function memoryToMiB(value) {
  const match = value.trim().match(/^([0-9.]+)([KMG]iB)$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  return amount * ({ kib: 1 / 1024, mib: 1, gib: 1024 }[match[2].toLowerCase()] || 1);
}

function sampleResources() {
  const backendId = composeSync(["ps", "-q", "backend"], { capture: true }).trim();
  const databaseId = composeSync(["ps", "-q", "db"], { capture: true }).trim();
  if (!backendId || !databaseId) throw new Error("Qualification containers are not running");

  const output = execFileSync(
    "docker",
    ["stats", "--no-stream", "--format", "{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}", backendId, databaseId],
    { encoding: "utf8" },
  );
  for (const line of output.trim().split(/\r?\n/)) {
    const [name, memory, cpu] = line.split("|");
    samples.push({ at: new Date().toISOString(), name, memory, memoryMiB: memoryToMiB(memory.split("/")[0]), cpu });
  }
}

async function writeResourceEvidence(extra = {}) {
  const backendPeak = Math.max(
    0,
    ...samples.filter(({ name }) => name?.includes("backend")).map(({ memoryMiB }) => memoryMiB),
  );
  const databasePeak = Math.max(
    0,
    ...samples.filter(({ name }) => name?.includes("db")).map(({ memoryMiB }) => memoryMiB),
  );
  const evidence = {
    profile,
    requestedRepetitions: repetitions,
    completedRepetitions,
    backendPeakMiB: backendPeak,
    databasePeakMiB: databasePeak,
    ...extra,
    samples,
  };
  await writeFile(
    path.join(artifactDirectory, "resource-usage.json"),
    JSON.stringify(evidence, null, 2),
  );
  return evidence;
}

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  process.env.QA_PROFILE = profile;
  const summaryPath = `/artifacts/k6-${profile}-${repetition}.json`;
  const child = composeSpawn([
    "--profile",
    "tools",
    "run",
    "--rm",
    "-e",
    `QA_PROFILE=${profile}`,
    "k6",
    "run",
    "--summary-export",
    summaryPath,
    "/scripts/mixed-load.js",
  ]);

  const sampler = setInterval(() => {
    try {
      sampleResources();
    } catch (error) {
      samples.push({ at: new Date().toISOString(), samplingError: error.message });
    }
  }, 5_000);

  const exitCode = await new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
  clearInterval(sampler);
  sampleResources();

  if (exitCode !== 0 && profile !== "breakpoint") {
    await writeResourceEvidence({ failedRepetition: repetition, k6ExitCode: exitCode });
    throw new Error(`k6 ${profile} repetition ${repetition} failed with exit code ${exitCode}`);
  }
  completedRepetitions += 1;
}

const { backendPeakMiB: backendPeak, databasePeakMiB: databasePeak } =
  await writeResourceEvidence();

if (backendPeak >= 512) throw new Error(`Backend peak memory ${backendPeak.toFixed(1)} MiB exceeded 512 MiB`);
if (databasePeak >= 1024) throw new Error(`Database peak memory ${databasePeak.toFixed(1)} MiB exceeded 1024 MiB`);

console.log(JSON.stringify({ profile, repetitions, backendPeakMiB: backendPeak, databasePeakMiB: databasePeak }));
