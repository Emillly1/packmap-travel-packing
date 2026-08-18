import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";

const root = "dist";
const files = [];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
}

walk(root);
const totalBytes = files.reduce((total, path) => total + statSync(path).size, 0);
const gzipSizes = (extension) => files
  .filter((path) => extname(path) === extension)
  .map((path) => gzipSync(readFileSync(path)).byteLength);
const budgets = [
  { label: "largest JavaScript gzip", actual: Math.max(0, ...gzipSizes(".js")), limit: 50 * 1024 },
  { label: "largest CSS gzip", actual: Math.max(0, ...gzipSizes(".css")), limit: 16 * 1024 },
  { label: "complete dist", actual: totalBytes, limit: 1100 * 1024 },
];
const failures = budgets.filter((budget) => budget.actual > budget.limit);

for (const budget of budgets) {
  const status = budget.actual <= budget.limit ? "PASS" : "FAIL";
  console.log(`${status} ${budget.label}: ${(budget.actual / 1024).toFixed(1)} KiB / ${(budget.limit / 1024).toFixed(1)} KiB`);
}
if (failures.length) process.exitCode = 1;
