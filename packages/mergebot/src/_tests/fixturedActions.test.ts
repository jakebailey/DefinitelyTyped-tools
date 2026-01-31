import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import * as mockCachedQueries from "./cachedQueries";

// Mock the cachedQueries module before importing modules that depend on it
mock.module(join(__dirname, "../util/cachedQueries.js"), { namedExports: mockCachedQueries });

import { process as processAction } from "../compute-pr-actions";
import { deriveStateForPR, PRQueryResponse } from "../pr-info";
import { readJsonSync, scrubDiagnosticDetails } from "../util/util";
import { executePrActions } from "../execute-pr-actions";

function toMatchFile(actual: string, filePath: string): void {
  const updateSnapshots = globalThis.process.argv.includes("--test-update-snapshots");
  if (updateSnapshots || !existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, actual);
    return;
  }
  const expected = readFileSync(filePath, "utf-8");
  assert.strictEqual(actual, expected, `Snapshot mismatch for ${filePath}`);
}

/* You can use the following command to add/update fixtures with an existing PR
 *
 *     BOT_AUTH_TOKEN=XYZ pnpm run create-fixture 43164
 */

async function testFixture(dir: string) {
  // _foo.json are input files, except for Date.now from derived.json
  const responsePath = join(dir, "_response.json");
  const filesPath = join(dir, "_files.json");
  const downloadsPath = join(dir, "_downloads.json");
  const derivedPath = join(dir, "derived.json");
  const resultPath = join(dir, "result.json");
  const mutationsPath = join(dir, "mutations.json");

  const jsonString = (value: unknown) => scrubDiagnosticDetails(JSON.stringify(value, null, "  ") + "\n");

  const response: PRQueryResponse = readJsonSync(responsePath);
  const files = readJsonSync(filesPath);
  const downloads = readJsonSync(downloadsPath);

  const prInfo = response.data.repository?.pullRequest;
  if (!prInfo) throw new Error("Should never happen");

  const derived = await deriveStateForPR(
    prInfo,
    (expr: string) => Promise.resolve(files[expr] as string),
    (name: string, _until?: Date) => (name in downloads ? downloads[name] : 0),
    new Date(readJsonSync(derivedPath).now),
  );

  const action = processAction(derived);

  toMatchFile(jsonString(action), resultPath);
  toMatchFile(jsonString(derived), derivedPath);
  const mutations = await executePrActions(action, prInfo, /*dry*/ true);
  toMatchFile(jsonString(mutations), mutationsPath);
}

describe("Test fixtures", () => {
  // Fixtures are in src/_tests/fixtures, not dist
  const fixturesFolder = join(__dirname, "../../src/_tests/fixtures");
  readdirSync(fixturesFolder, { withFileTypes: true }).forEach((dirent) => {
    if (dirent.isDirectory()) {
      it(`Fixture: ${dirent.name}`, async () => testFixture(join(fixturesFolder, dirent.name)));
    }
  });
});
