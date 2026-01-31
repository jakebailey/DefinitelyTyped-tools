import { describe, it } from "node:test";
import assert from "node:assert";
import { NotNeededPackage } from "@definitelytyped/definitions-parser";
import { isAlreadyDeprecated } from "../src/calculate-versions";

describe("isAlreadyDeprecated", () => {
  const shouldSkip = !process.env.GITHUB_ACTIONS;

  it("should report @types/commander as deprecated", { skip: shouldSkip }, async () => {
    const pkg = new NotNeededPackage("@types/commander", "commander", "2.12.2");
    const result = await isAlreadyDeprecated(pkg, { info: () => {}, error: () => {} });
    assert.strictEqual(!!result, true);
  });
});
