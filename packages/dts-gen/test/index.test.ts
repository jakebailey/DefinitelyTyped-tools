import { describe, it } from "node:test";
import * as tsg from "../src";

const testModuleNames = ["lodash", "jquery", "yargs", "ecurve"];

class MyClass {
  constructor(public arg: number) {}
  prototypeMethod(_p: any) {}
  static staticMethod(_s: any) {}
  static staticNum = 32;
  instanceStr = "inst";
}

function overriddenToString() {}
overriddenToString.toString = () => {
  throw new Error("`fn.toString()` should not be called");
};

const selfRefExpr = {
  a: 32,
  b: "ok",
  self: <any>null,
};
selfRefExpr.self = selfRefExpr;

const expressions: { [s: string]: any } = {
  selfref: selfRefExpr,
  builtIns: { d: new Date(3), arr: ["x"] },
  someArray: [1, "foo", Math, null, undefined, false],
  badNames: { "*": 10, default: true, with: 10, "  ": 3 },
  someClass: MyClass,
  overriddenToString,
};

describe("Module tests", () => {
  for (const moduleName of testModuleNames) {
    it(`Generates the same declaration for ${moduleName}`, (t) => {
      const result = tsg.generateModuleDeclarationFile(moduleName!, require(moduleName!));
      t.assert.snapshot(result);
    });
  }
});

describe("Expression tests", () => {
  for (const key of Object.keys(expressions)) {
    it(`Generates the same declaration for ${key}`, (t) => {
      const result = tsg.generateIdentifierDeclarationFile(key!, expressions[key!]);
      t.assert.snapshot(result);
    });
  }
});
