#!/usr/bin/env node
// Cross-platform test runner that finds all test files and runs them with node --test
const { spawn } = require("node:child_process");
const { readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

function findTestFiles(dir, pattern) {
  const results = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath, pattern));
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// Find all test files
const testFiles = [];

// packages/*/test/**/*.test.js
const packagesDir = join(root, "packages");
for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const testDir = join(packagesDir, pkg.name, "test");
  testFiles.push(...findTestFiles(testDir, /\.test\.js$/));
}

// packages/dts-critic/dist/index.test.js
const dtsCriticTest = join(root, "packages/dts-critic/dist/index.test.js");
if (existsSync(dtsCriticTest)) {
  testFiles.push(dtsCriticTest);
}

// packages/mergebot/dist/_tests/*.test.js
const mergebotTestDir = join(root, "packages/mergebot/dist/_tests");
testFiles.push(...findTestFiles(mergebotTestDir, /\.test\.js$/));

if (testFiles.length === 0) {
  console.error("No test files found. Did you run `pnpm build` first?");
  process.exit(1);
}

console.log(`Running ${testFiles.length} test files...`);

const args = ["--experimental-test-module-mocks", "--test", ...testFiles];
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  cwd: root,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
