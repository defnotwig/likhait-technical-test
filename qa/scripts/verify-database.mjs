import { mkdir, writeFile } from "node:fs/promises";
import { composeSync, qaRoot } from "./compose-helpers.mjs";
import path from "node:path";

const query = [
  "SELECT COUNT(*) AS expense_count FROM expenses;",
  "SHOW INDEX FROM expenses WHERE Key_name='index_expenses_on_date';",
  "EXPLAIN SELECT expenses.* FROM expenses WHERE expenses.date BETWEEN '2025-01-01' AND '2025-01-31' ORDER BY expenses.date DESC, expenses.created_at DESC, expenses.id DESC;",
].join(" ");

const output = composeSync(
  [
    "exec",
    "-T",
    "db",
    "mysql",
    "-uqa_user",
    "-pqa_password",
    "expense_system_qa",
    "-e",
    query,
  ],
  { capture: true },
);

if (!output.includes("index_expenses_on_date")) {
  throw new Error("MySQL did not report index_expenses_on_date in index/EXPLAIN evidence");
}

const artifacts = path.join(qaRoot, "artifacts");
await mkdir(artifacts, { recursive: true });
await writeFile(path.join(artifacts, "mysql-index-explain.txt"), output);
console.log(output);
