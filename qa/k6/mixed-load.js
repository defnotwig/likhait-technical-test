import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const apiUrl = __ENV.QA_API_URL || "http://backend:3000/api";
const profile = __ENV.QA_PROFILE || "ci";
const seed = __ENV.QA_SEED || "20260801";

const readDuration = new Trend("qa_read_duration", true);
const writeDuration = new Trend("qa_write_duration", true);
const unexpectedResponse = new Rate("qa_unexpected_response");
const unexpected5xx = new Counter("qa_unexpected_5xx");
let pendingExpenseId = null;

const profiles = {
  smoke: {
    executor: "shared-iterations",
    vus: 2,
    iterations: 20,
    maxDuration: "30s",
  },
  ci: {
    executor: "ramping-arrival-rate",
    startRate: 10,
    timeUnit: "1s",
    preAllocatedVUs: 30,
    maxVUs: 100,
    stages: [
      { target: 40, duration: "30s" },
      { target: 40, duration: "60s" },
      { target: 10, duration: "30s" },
    ],
  },
  full: {
    executor: "ramping-arrival-rate",
    startRate: 10,
    timeUnit: "1s",
    preAllocatedVUs: 100,
    maxVUs: 300,
    stages: [
      { target: 25, duration: "2m" },
      { target: 50, duration: "3m" },
      { target: 100, duration: "3m" },
      { target: 40, duration: "2m" },
      { target: 40, duration: "30m" },
      { target: 100, duration: "30s" },
      { target: 40, duration: "60s" },
      { target: 0, duration: "30s" },
    ],
  },
  breakpoint: {
    executor: "ramping-arrival-rate",
    startRate: 50,
    timeUnit: "1s",
    preAllocatedVUs: 150,
    maxVUs: 400,
    stages: [
      { target: 50, duration: "1m" },
      { target: 100, duration: "1m" },
      { target: 150, duration: "1m" },
      { target: 200, duration: "1m" },
      { target: 0, duration: "30s" },
    ],
  },
};

export const options = {
  discardResponseBodies: false,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  scenarios: { mixed: profiles[profile] || profiles.ci },
  thresholds:
    profile === "breakpoint"
      ? {
          checks: ["rate==1"],
          qa_unexpected_5xx: ["count==0"],
        }
      : {
          checks: ["rate==1"],
          qa_unexpected_response: ["rate==0"],
          qa_unexpected_5xx: ["count==0"],
          dropped_iterations: ["count==0"],
          qa_read_duration: ["p(95)<750", "p(99)<1500"],
          qa_write_duration: ["p(95)<1000", "p(99)<2000"],
        },
};

export function setup() {
  const response = http.get(`${apiUrl}/categories`, { tags: { operation: "setup" } });
  const valid = check(response, { "setup categories returns 200": (value) => value.status === 200 });
  if (!valid) throw new Error(`Category setup failed with ${response.status}`);

  const category = response.json().find(({ name }) => name === "Food") || response.json()[0];
  const updateFixture = http.post(
    `${apiUrl}/expenses`,
    JSON.stringify({
      expense: {
        amount: "9.99",
        description: `QA-LOAD-UPDATE-${seed}`,
        category_id: category.id,
        date: "2025-06-15",
      },
    }),
    { headers: { "Content-Type": "application/json" }, tags: { operation: "setup" } },
  );
  const fixtureValid = check(updateFixture, {
    "setup update fixture returns 201": (value) => value.status === 201,
  });
  if (!fixtureValid) throw new Error(`Update fixture setup failed with ${updateFixture.status}`);

  return { categoryId: category.id, updateExpenseId: updateFixture.json("id") };
}

function record(response, expectedStatus, trend) {
  trend.add(response.timings.duration);
  const expected = response.status === expectedStatus;
  unexpectedResponse.add(!expected);
  if (response.status >= 500) unexpected5xx.add(1);
  check(response, { [`status is ${expectedStatus}`]: () => expected });
  return expected;
}

export default function (data) {
  // Each iteration performs exactly one request so the arrival rate is an
  // actual request rate rather than an optimistic iteration-rate proxy.
  const selector = (__ITER * 37 + __VU * 13) % 100;

  if (selector < 80) {
    const month = (__ITER % 12) + 1;
    const response = http.get(`${apiUrl}/expenses?year=2025&month=${month}`, {
      headers: { "Accept-Encoding": "gzip" },
      tags: { operation: "read_month" },
    });
    record(response, 200, readDuration);
    return;
  }

  if (selector >= 88 && selector < 94) {
    const updateResponse = http.patch(
      `${apiUrl}/expenses/${data.updateExpenseId}`,
      JSON.stringify({ expense: { amount: "10.01", description: `QA-LOAD-UPDATE-${seed}` } }),
      { headers: { "Content-Type": "application/json" }, tags: { operation: "update" } },
    );
    record(updateResponse, 200, writeDuration);
    return;
  }

  if (selector >= 94 && pendingExpenseId !== null) {
    const deleteResponse = http.del(`${apiUrl}/expenses/${pendingExpenseId}`, null, {
      tags: { operation: "delete" },
    });
    if (record(deleteResponse, 204, writeDuration)) pendingExpenseId = null;
    return;
  }

  const marker = `QA-LOAD-${seed}-${__VU}-${__ITER}`;
  const createResponse = http.post(
    `${apiUrl}/expenses`,
    JSON.stringify({
      expense: {
        amount: "9.99",
        description: marker,
        category_id: data.categoryId,
        date: "2025-06-15",
      },
    }),
    { headers: { "Content-Type": "application/json" }, tags: { operation: "create" } },
  );

  if (record(createResponse, 201, writeDuration)) pendingExpenseId = createResponse.json("id");
}
