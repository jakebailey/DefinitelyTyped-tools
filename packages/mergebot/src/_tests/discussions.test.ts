import { describe, it } from "node:test";
import assert from "node:assert";
import { canHandleRequest, extractNPMReference } from "../discussions";

describe("canHandleRequest", () => {
  const eventActions = [
    ["discussion", "created", true],
    ["discussion", "edited", true],
    ["discussion", "updated", false],
    ["pull_request", "created", false],
  ] as const;

  for (const [event, action, expected] of eventActions) {
    it(`(${event}, ${action}) is ${expected}`, async () => {
      assert.strictEqual(canHandleRequest(event, action), expected);
    });
  }
});

describe("extractNPMReference", () => {
  const eventActions = [
    ["[node] my thingy", "node"],
    ["OK [react]", "react"],
    ["I  think [@typescript/twoslash] need improving ", "@typescript/twoslash"],
    ["[@types/node] needs X", "node"],
  ] as const;

  for (const [title, result] of eventActions) {
    it(`extracts ${result} from "${title}"`, async () => {
      assert.strictEqual(extractNPMReference({ title }), result);
    });
  }
});
