import path from "path";
import { describe, it } from "node:test";
import assert from "node:assert";
import { findDtsName, dtToNpmName, parseExportErrorKind, checkSource, ErrorKind, ExportErrorKind } from "./index";

// When running from dist/, go up one level to find testsource
const testsourceDir = path.resolve(__dirname, "../testsource");

function suite(description: string, tests: { [s: string]: () => void }) {
  describe(description, { timeout: 10 * 1000 }, () => {
    for (const k in tests) {
      it(k, tests[k]);
    }
  });
}

suite("findDtsName", {
  absolutePath() {
    assert.strictEqual(findDtsName("~/dt/types/jquery/index.d.ts"), "jquery");
  },
  relativePath() {
    assert.strictEqual(findDtsName("jquery/index.d.ts"), "jquery");
  },
  currentDirectory() {
    assert.strictEqual(findDtsName("index.d.ts"), "DefinitelyTyped-tools");
  },
  relativeCurrentDirectory() {
    assert.strictEqual(findDtsName("./index.d.ts"), "DefinitelyTyped-tools");
  },
  emptyDirectory() {
    assert.strictEqual(findDtsName(""), "DefinitelyTyped-tools");
  },
});
suite("dtToNpmName", {
  nonScoped() {
    assert.strictEqual(dtToNpmName("content-type"), "content-type");
  },
  scoped() {
    assert.strictEqual(dtToNpmName("babel__core"), "@babel/core");
  },
});
suite("parseExportErrorKind", {
  existent() {
    assert.strictEqual(parseExportErrorKind("NoDefaultExport"), ErrorKind.NoDefaultExport);
  },
  existentDifferentCase() {
    assert.strictEqual(parseExportErrorKind("JspropertyNotinDTS"), ErrorKind.JsPropertyNotInDts);
  },
  nonexistent() {
    assert.strictEqual(parseExportErrorKind("FakeError"), undefined);
  },
});

const allErrors: Map<ExportErrorKind, true> = new Map([
  [ErrorKind.NeedsExportEquals, true],
  [ErrorKind.NoDefaultExport, true],
  [ErrorKind.JsSignatureNotInDts, true],
  [ErrorKind.DtsSignatureNotInJs, true],
  [ErrorKind.DtsPropertyNotInJs, true],
  [ErrorKind.JsPropertyNotInDts, true],
]);

function testsource(filename: string) {
  return path.join(testsourceDir, filename);
}

function assertContainsError(actual: any[], expected: any) {
  const found = actual.some(
    (item) =>
      item.kind === expected.kind &&
      item.message === expected.message &&
      (expected.position === undefined ||
        (item.position?.start === expected.position.start && item.position?.length === expected.position.length)),
  );
  assert.ok(found, `Expected array to contain ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
}

suite("checkSource", {
  noErrors() {
    assert.deepStrictEqual(
      checkSource("noErrors", testsource("noErrors.d.ts"), testsource("noErrors.js"), allErrors, false),
      [],
    );
  },
  missingJsProperty() {
    const result = checkSource(
      "missingJsProperty",
      testsource("missingJsProperty.d.ts"),
      testsource("missingJsProperty.js"),
      allErrors,
      false,
    );
    assertContainsError(result, {
      kind: ErrorKind.JsPropertyNotInDts,
      message: `The declaration doesn't match the JavaScript module 'missingJsProperty'. Reason:
The JavaScript module exports a property named 'foo', which is missing from the declaration module.`,
    });
  },
  noMissingWebpackProperty() {
    const result = checkSource(
      "missingJsProperty",
      testsource("webpackPropertyNames.d.ts"),
      testsource("webpackPropertyNames.js"),
      allErrors,
      false,
    );
    assert.strictEqual(result.length, 0);
  },
  missingDtsProperty() {
    const result = checkSource(
      "missingDtsProperty",
      testsource("missingDtsProperty.d.ts"),
      testsource("missingDtsProperty.js"),
      allErrors,
      false,
    );
    assertContainsError(result, {
      kind: ErrorKind.DtsPropertyNotInJs,
      message: `The declaration doesn't match the JavaScript module 'missingDtsProperty'. Reason:
The declaration module exports a property named 'foo', which is missing from the JavaScript module.`,
      position: {
        start: 65,
        length: 11,
      },
    });
  },
  missingDefaultExport() {
    const result = checkSource(
      "missingDefault",
      testsource("missingDefault.d.ts"),
      testsource("missingDefault.js"),
      allErrors,
      false,
    );
    assertContainsError(result, {
      kind: ErrorKind.NoDefaultExport,
      message: `The declaration doesn't match the JavaScript module 'missingDefault'. Reason:
The declaration specifies 'export default' but the JavaScript source does not mention 'default' anywhere.

The most common way to resolve this error is to use 'export =' syntax instead of 'export default'.
To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
      position: {
        start: 0,
        length: 33,
      },
    });
  },
  missingJsSignatureExportEquals() {
    const result = checkSource(
      "missingJsSignatureExportEquals",
      testsource("missingJsSignatureExportEquals.d.ts"),
      testsource("missingJsSignatureExportEquals.js"),
      allErrors,
      false,
    );
    assertContainsError(result, {
      kind: ErrorKind.JsSignatureNotInDts,
      message: `The declaration doesn't match the JavaScript module 'missingJsSignatureExportEquals'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.`,
    });
  },
  missingJsSignatureNoExportEquals() {
    const result = checkSource(
      "missingJsSignatureNoExportEquals",
      testsource("missingJsSignatureNoExportEquals.d.ts"),
      testsource("missingJsSignatureNoExportEquals.js"),
      allErrors,
      false,
    );
    assertContainsError(result, {
      kind: ErrorKind.JsSignatureNotInDts,
      message: `The declaration doesn't match the JavaScript module 'missingJsSignatureNoExportEquals'. Reason:
The JavaScript module can be called or constructed, but the declaration module cannot.

The most common way to resolve this error is to use 'export =' syntax.
To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
    });
  },
  missingDtsSignature() {
    const result = checkSource(
      "missingDtsSignature",
      testsource("missingDtsSignature.d.ts"),
      testsource("missingDtsSignature.js"),
      allErrors,
      false,
    );
    assertContainsError(result, {
      kind: ErrorKind.DtsSignatureNotInJs,
      message: `The declaration doesn't match the JavaScript module 'missingDtsSignature'. Reason:
The declaration module can be called or constructed, but the JavaScript module cannot.`,
    });
  },
  missingExportEquals() {
    const result = checkSource(
      "missingExportEquals",
      testsource("missingExportEquals.d.ts"),
      testsource("missingExportEquals.js"),
      allErrors,
      false,
    );
    assertContainsError(result, {
      kind: ErrorKind.NeedsExportEquals,
      message: `The declaration doesn't match the JavaScript module 'missingExportEquals'. Reason:
The declaration should use 'export =' syntax because the JavaScript source uses 'module.exports =' syntax and 'module.exports' can be called or constructed.

To learn more about 'export =' syntax, see https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.`,
    });
  },
});
