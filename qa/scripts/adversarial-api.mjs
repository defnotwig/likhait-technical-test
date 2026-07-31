import { mkdir, writeFile } from "node:fs/promises";
import { assertSafeTarget } from "./guard-target.mjs";

const apiUrl = (process.env.QA_API_URL || "http://127.0.0.1:3100/api").replace(/\/+$/, "");
assertSafeTarget(apiUrl);

const seed = process.env.QA_SEED || "20260801";
const marker = `${seed}-${Date.now()}`;
const results = [];

function record(name, passed, evidence) {
  results.push({ name, passed, evidence });
  if (!passed) throw new Error(`${name} failed: ${JSON.stringify(evidence)}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    signal: AbortSignal.timeout(30_000),
    ...options,
  });
  let body;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

const categoryRaceName = `QA Race ${marker}`;
const raceVariants = Array.from({ length: 100 }, (_, index) => {
  if (index % 3 === 0) return `  ${categoryRaceName}  `;
  if (index % 3 === 1) return categoryRaceName.toLowerCase();
  return categoryRaceName.toUpperCase();
});

const raceResponses = await Promise.all(
  raceVariants.map((name) =>
    request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: { name } }),
    }),
  ),
);
const raceStatuses = raceResponses.reduce((counts, response) => {
  counts[response.status] = (counts[response.status] || 0) + 1;
  return counts;
}, {});
record("concurrent duplicate category", raceStatuses[201] === 1 && raceStatuses[422] === 99, raceStatuses);

const unicodeResponses = await Promise.all(
  Array.from({ length: 100 }, (_, index) =>
    request("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: { name: `支出-${marker}-${index}` } }),
    }),
  ),
);
record(
  "unique Unicode categories",
  unicodeResponses.every(({ status }) => status === 201),
  unicodeResponses.reduce((counts, response) => {
    counts[response.status] = (counts[response.status] || 0) + 1;
    return counts;
  }, {}),
);

const categories = await request("/categories");
const food = categories.body.find(({ name }) => name === "Food");
record("category fixture available", categories.status === 200 && Boolean(food), {
  status: categories.status,
  foodId: food?.id,
});

const utcToday = new Date().toISOString().slice(0, 10);
const tomorrowValue = new Date(`${utcToday}T12:00:00Z`);
tomorrowValue.setUTCDate(tomorrowValue.getUTCDate() + 1);
const tomorrow = tomorrowValue.toISOString().slice(0, 10);

const futureCreates = await Promise.all(
  Array.from({ length: 100 }, (_, index) =>
    request("/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expense: {
          amount: 10,
          description: `QA-FUTURE-${marker}-${index}`,
          category_id: food.id,
          date: tomorrow,
        },
      }),
    }),
  ),
);
record(
  "future create race",
  futureCreates.every(({ status, body }) => status === 422 && body.errors?.includes("Date cannot be in the future")),
  futureCreates.reduce((counts, response) => {
    counts[response.status] = (counts[response.status] || 0) + 1;
    return counts;
  }, {}),
);

const validExpense = await request("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expense: {
      amount: 10,
      description: `QA-UPDATE-${marker}`,
      category_id: food.id,
      date: utcToday,
    },
  }),
});
record("today expense accepted", validExpense.status === 201, validExpense);

const futureUpdates = await Promise.all(
  Array.from({ length: 100 }, () =>
    request(`/expenses/${validExpense.body.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expense: { date: tomorrow } }),
    }),
  ),
);
record(
  "future update race",
  futureUpdates.every(({ status }) => status === 422),
  futureUpdates.reduce((counts, response) => {
    counts[response.status] = (counts[response.status] || 0) + 1;
    return counts;
  }, {}),
);

const allExpenses = await request("/expenses");
const unchanged = allExpenses.body.find(({ id }) => id === validExpense.body.id);
record("rejected updates preserve persisted date", unchanged?.date === utcToday, unchanged);

const newer = await request("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expense: { amount: 2, description: `QA-ORDER-NEW-${marker}`, category_id: food.id, date: "2025-11-30" },
  }),
});
const older = await request("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expense: { amount: 1, description: `QA-ORDER-OLD-${marker}`, category_id: food.id, date: "2025-11-01" },
  }),
});
const november = await request("/expenses?year=2025&month=11");
const newerIndex = november.body.findIndex(({ id }) => id === newer.body.id);
const olderIndex = november.body.findIndex(({ id }) => id === older.body.id);
const descending = november.body.every((expense, index, list) => index === 0 || list[index - 1].date >= expense.date);
record("date ordering under scaled data", newerIndex >= 0 && olderIndex > newerIndex && descending, {
  count: november.body.length,
  newerIndex,
  olderIndex,
  descending,
});

const malformedJson = await request("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{not-json",
});
record("malformed JSON controlled response", malformedJson.status === 400, { status: malformedJson.status });

const missingRoot = await request("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
record("missing payload root controlled response", missingRoot.status === 400, { status: missingRoot.status });

const invalidPeriod = await request("/expenses?year=2026&month=13");
record("invalid period controlled response", invalidPeriod.status === 422, invalidPeriod);

const overlong = await request("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expense: { amount: 1, description: "x".repeat(256), category_id: food.id, date: utcToday },
  }),
});
record("overlong description rejected", overlong.status === 422, { status: overlong.status });

const oversized = await request("/expenses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expense: { amount: 1, description: "x".repeat(1_000_000), category_id: food.id, date: utcToday },
  }),
});
record("one-megabyte description rejected", oversized.status === 422, { status: oversized.status });

const injection = await request("/categories", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ category: { name: `QA SQL ${marker}'); DROP TABLE expenses;--` } }),
});
record("SQL-like category remains inert", injection.status === 201, { status: injection.status });

for (const id of [validExpense.body.id, newer.body.id, older.body.id]) {
  const deleted = await request(`/expenses/${id}`, { method: "DELETE" });
  record(`cleanup expense ${id}`, deleted.status === 204, { status: deleted.status });
}

await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../artifacts/adversarial-api.json", import.meta.url),
  JSON.stringify({ apiUrl, seed, generatedAt: new Date().toISOString(), results }, null, 2),
);

console.log(JSON.stringify({ passed: results.length, apiUrl, seed }));
