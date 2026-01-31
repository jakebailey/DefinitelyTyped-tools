import { describe, it } from "node:test";
import assert from "node:assert";
import { CompilerOptionsRaw, checkTsconfig } from "../src/checks";
import { assertPackageIsNotDeprecated } from "../src/index";

describe("dtslint", () => {
  const base: CompilerOptionsRaw = {
    module: "commonjs",
    lib: ["es6"],
    noImplicitAny: true,
    noImplicitThis: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    types: [],
    noEmit: true,
    forceConsistentCasingInFileNames: true,
  };
  function based(extra: object) {
    return { compilerOptions: { ...base, ...extra }, files: ["index.d.ts", "base.test.ts"] };
  }
  describe("checks", () => {
    describe("checkTsconfig", () => {
      it("disallows unknown compiler options", () => {
        assert.deepStrictEqual(checkTsconfig(based({ completelyInvented: true })), [
          "Unexpected compiler option completelyInvented",
        ]);
      });
      it("allows exactOptionalPropertyTypes: true", () => {
        assert.deepStrictEqual(checkTsconfig(based({ exactOptionalPropertyTypes: true })), []);
      });
      it("allows module: node16", () => {
        assert.deepStrictEqual(checkTsconfig(based({ module: "node16" })), []);
      });
      it("allows `paths`", () => {
        assert.deepStrictEqual(checkTsconfig(based({ paths: { boom: ["../boom/index.d.ts"] } })), []);
      });
      it("disallows missing `module`", () => {
        const compilerOptions = { ...base };
        delete compilerOptions.module;
        assert.deepStrictEqual(checkTsconfig({ compilerOptions, files: ["index.d.ts", "base.test.ts"] }), [
          'Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.',
        ]);
      });
      it("disallows exactOptionalPropertyTypes: false", () => {
        assert.deepStrictEqual(checkTsconfig(based({ exactOptionalPropertyTypes: false })), [
          'When "exactOptionalPropertyTypes" is present, it must be set to `true`.',
        ]);
      });
      it("allows paths: self-reference", () => {
        assert.deepStrictEqual(checkTsconfig(based({ paths: { "react-native": ["./index.d.ts"] } })), []);
      });
      it("allows paths: matching ../reference/index.d.ts", () => {
        assert.deepStrictEqual(checkTsconfig(based({ paths: { "react-native": ["../react-native/index.d.ts"] } })), []);
        assert.deepStrictEqual(
          checkTsconfig(
            based({ paths: { "react-native": ["../react-native/index.d.ts"], react: ["../react/v16/index.d.ts"] } }),
          ),
          [],
        );
      });
      it("forbids paths: mapping to multiple things", () => {
        assert.deepStrictEqual(
          checkTsconfig(based({ paths: { "react-native": ["./index.d.ts", "../react-native/v0.68/index.d.ts"] } })),
          [`"paths" must map each module specifier to only one file.`],
        );
      });
      it("allows paths: matching ../reference/version/index.d.ts", () => {
        assert.deepStrictEqual(checkTsconfig(based({ paths: { react: ["../react/v16/index.d.ts"] } })), []);
        assert.deepStrictEqual(
          checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.69/index.d.ts"] } })),
          [],
        );
        assert.deepStrictEqual(
          checkTsconfig(based({ paths: { "react-native": ["../../react-native/v0.69/index.d.ts"] } })),
          [],
        );
      });
      it("forbids paths: mapping to self-contained file", () => {
        assert.deepStrictEqual(checkTsconfig(based({ paths: { "react-native": ["./other.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../NOT/index.d.ts", () => {
        assert.deepStrictEqual(checkTsconfig(based({ paths: { "react-native": ["../cocoa/index.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT.d.ts", () => {
        assert.deepStrictEqual(checkTsconfig(based({ paths: { "react-native": ["../react-native/other.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT/index.d.ts", () => {
        assert.deepStrictEqual(
          checkTsconfig(based({ paths: { "react-native": ["../react-native/deep/index.d.ts"] } })),
          [`"paths" must map 'react-native' to react-native's index.d.ts.`],
        );
      });
      it("forbids paths: mismatching ../react-native/version/NOT/index.d.ts", () => {
        assert.deepStrictEqual(
          checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.68/deep/index.d.ts"] } })),
          [`"paths" must map 'react-native' to react-native's index.d.ts.`],
        );
      });
      it("forbids paths: mismatching ../react-native/version/NOT.d.ts", () => {
        assert.deepStrictEqual(
          checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.70/other.d.ts"] } })),
          [`"paths" must map 'react-native' to react-native's index.d.ts.`],
        );
      });
      it("Forbids exclude", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, exclude: ["**/node_modules"] }), [
          `Use "files" instead of "exclude".`,
        ]);
      });
      it("Forbids include", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, include: ["**/node_modules"] }), [
          `Use "files" instead of "include".`,
        ]);
      });
      it("Requires files", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base }), [`Must specify "files".`]);
      });
      it("Requires files to contain index.d.ts", () => {
        assert.deepStrictEqual(
          checkTsconfig({ compilerOptions: base, files: ["package-name.d.ts", "package-name.test.ts"] }),
          [`"files" list must include "index.d.ts".`],
        );
      });
      // it("Requires files to contain .[mc]ts file", () => {
      //   assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, files: ["index.d.ts"] }), [
      //     `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
      //   ]);
      // });
      it("Allows files to contain index.d.ts plus a .tsx", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.tsx"] }), []);
      });
      it("Allows files to contain index.d.ts plus a .mts", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.mts"] }), []);
      });
      it("Allows files to contain index.d.ts plus a .cts", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.cts"] }), []);
      });
      it("Allows files to contain ./index.d.ts plus a ./.tsx", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, files: ["./index.d.ts", "./tests.tsx"] }), []);
      });
      it("Issues both errors on empty files list", () => {
        assert.deepStrictEqual(checkTsconfig({ compilerOptions: base, files: [] }), [
          `"files" list must include "index.d.ts".`,
          // `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
        ]);
      });
    });
    describe("assertPackageIsNotDeprecated", () => {
      it("disallows packages that are in notNeededPackages.json", () => {
        assert.throws(
          () => assertPackageIsNotDeprecated("foo", '{ "packages": { "foo": { } } }'),
          /notNeededPackages.json has an entry for foo./,
        );
      });
      it("allows packages that are not in notNeededPackages.json", () => {
        assert.strictEqual(assertPackageIsNotDeprecated("foo", '{ "packages": { "bar": { } } }'), undefined);
      });
    });
  });
});
