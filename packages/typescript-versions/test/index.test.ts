import { describe, it } from "node:test";
import assert from "node:assert";
import { TypeScriptVersion } from "../src";

describe("unsupported", () => {
  it("contains at least 2.9", () => {
    assert.ok(TypeScriptVersion.unsupported.includes("2.9"));
  });
});

describe("all", () => {
  it("doesn't have any holes", () => {
    let prev = TypeScriptVersion.all[0];
    for (const version of TypeScriptVersion.all.slice(1)) {
      assert.strictEqual(+version * 10 - +prev * 10, 1);
      prev = version;
    }
  });
});

describe("isSupported", () => {
  it("works", () => {
    assert.ok(TypeScriptVersion.isSupported("5.6"));
  });
  it("supports 5.2", () => {
    assert.ok(TypeScriptVersion.isSupported("5.2"));
  });
  it("does not support 4.0", () => {
    assert.ok(!TypeScriptVersion.isSupported("4.0"));
  });
});

describe("isTypeScriptVersion", () => {
  it("accepts in-range", () => {
    assert.ok(TypeScriptVersion.isTypeScriptVersion("5.2"));
  });
  it("rejects out-of-range", () => {
    assert.ok(!TypeScriptVersion.isTypeScriptVersion("101.1"));
  });
  it("rejects garbage", () => {
    assert.ok(!TypeScriptVersion.isTypeScriptVersion("it'sa me, luigi"));
  });
});

describe("range", () => {
  it("works", () => {
    assert.deepStrictEqual(TypeScriptVersion.range("5.2"), [
      "5.2",
      "5.3",
      "5.4",
      "5.5",
      "5.6",
      "5.7",
      "5.8",
      "5.9",
      "6.0",
    ]);
  });
  it("includes 5.2 onwards", () => {
    assert.deepStrictEqual(TypeScriptVersion.range("5.2"), TypeScriptVersion.supported);
  });
});

describe("tagsToUpdate", () => {
  it("works", () => {
    assert.deepStrictEqual(TypeScriptVersion.tagsToUpdate("5.2"), [
      "ts5.2",
      "ts5.3",
      "ts5.4",
      "ts5.5",
      "ts5.6",
      "ts5.7",
      "ts5.8",
      "ts5.9",
      "ts6.0",
      "latest",
    ]);
  });
  it("allows 5.2 onwards", () => {
    assert.deepStrictEqual(
      TypeScriptVersion.tagsToUpdate("5.2"),
      TypeScriptVersion.supported.map((s) => "ts" + s).concat("latest"),
    );
  });
});
