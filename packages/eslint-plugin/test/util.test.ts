import { describe, it } from "node:test";
import assert from "node:assert";
import path from "path";
import { findTypesPackage, getTypesPackageForDeclarationFile } from "../src/util";
import { fixtureRoot } from "./util";

function getFixturePath(filename: string): string {
  return path.join(fixtureRoot, filename);
}

describe("getTypesPackageForDeclarationFile", () => {
  const cases: [string, string | undefined][] = [
    ["types/foo/index.d.ts", "foo"],
    ["types/foo/foo-tests.ts", undefined],
    ["types/foo/v1/index.d.ts", "foo"],
    ["types/foo/v1/foo-tests.ts", undefined],
    ["types/scoped__foo/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/scoped__foo-tests.ts", undefined],
    ["types/scoped__foo/v1/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/scoped__foo-tests.ts", undefined],
    ["bad.d.ts", undefined],
  ];

  for (const [input, expected] of cases) {
    it(`${input} becomes ${expected}`, () => {
      assert.strictEqual(getTypesPackageForDeclarationFile(getFixturePath(input)), expected);
    });
  }
});

describe("findTypesPackage realName", () => {
  const cases: [string, string | undefined][] = [
    ["types/foo/index.d.ts", "foo"],
    ["types/foo/foo-tests.ts", "foo"],
    ["types/foo/v1/index.d.ts", "foo"],
    ["types/foo/v1/foo-tests.ts", "foo"],
    ["types/scoped__foo/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/scoped__foo-tests.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/index.d.ts", "@scoped/foo"],
    ["types/scoped__foo/v1/scoped__foo-tests.ts", "@scoped/foo"],
    ["bad.d.ts", undefined],
  ];

  for (const [input, expected] of cases) {
    it(`${input} becomes ${expected}`, () => {
      const realName = findTypesPackage(getFixturePath(input))?.realName;
      assert.strictEqual(realName, expected);
    });
  }
});
