import { describe, it } from "node:test";
import assert from "node:assert";
import { validatePackageJson, makeTypesVersionsForPackageJson, License, getLicenseFromPackageJson } from "../src";

describe("validatePackageJson", () => {
  const pkgJson: Record<string, unknown> = {
    private: true,
    name: "@types/hapi",
    version: "18.0.9999",
    projects: ["https://github.com/hapijs/hapi", "https://hapijs.com"],
    minimumTypeScriptVersion: "4.2",
    dependencies: {
      "@types/boom": "*",
      "@types/catbox": "*",
      "@types/iron": "*",
      "@types/mimos": "*",
      "@types/node": "*",
      "@types/podium": "*",
      "@types/shot": "*",
      joi: "^17.3.0",
    },
    devDependencies: {
      "@types/hapi": "workspace:.",
    },
    owners: [
      {
        name: "Rafael Souza Fijalkowski",
        githubUsername: "rafaelsouzaf",
      },
      {
        name: "Justin Simms",
        url: "https://example.com/jhsimms",
      },
      {
        name: "Simon Schick",
        githubUsername: "SimonSchick",
      },
      {
        name: "Rodrigo Saboya",
        githubUsername: "saboya",
      },
    ],
  };
  const header = { ...pkgJson, nonNpm: false, libraryMajorVersion: 18, libraryMinorVersion: 0 };
  delete (header as any).dependencies;
  delete (header as any).devDependencies;
  delete (header as any).peerDependencies;
  delete (header as any).private;
  delete (header as any).version;
  it("requires private: true", () => {
    const pkg = { ...pkgJson };
    delete pkg.private;
    assert.deepStrictEqual(validatePackageJson("hapi", pkg, []), [
      `hapi's package.json has bad "private": must be \`"private": true\``,
    ]);
  });
  it("requires name", () => {
    const pkg = { ...pkgJson };
    delete pkg.name;
    assert.deepStrictEqual(validatePackageJson("hapi", pkg, []), [
      'hapi\'s package.json should have `"name": "@types/hapi"`',
    ]);
  });
  it("requires name to match", () => {
    assert.deepStrictEqual(validatePackageJson("hapi", { ...pkgJson, name: "@types/sad" }, []), [
      'hapi\'s package.json should have `"name": "@types/hapi"`',
    ]);
  });
  it("requires devDependencies", () => {
    const pkg = { ...pkgJson };
    delete pkg.devDependencies;
    assert.deepStrictEqual(validatePackageJson("hapi", pkg, []), [
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires devDependencies to contain self-package", () => {
    assert.deepStrictEqual(validatePackageJson("hapi", { ...pkgJson, devDependencies: {} }, []), [
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires devDependencies to contain self-package version 'workspace:.'", () => {
    assert.deepStrictEqual(validatePackageJson("hapi", { ...pkgJson, devDependencies: { "@types/hapi": "*" } }, []), [
      `hapi's package.json has bad "devDependencies": must include \`"@types/hapi": "workspace:."\``,
    ]);
  });
  it("requires version", () => {
    const pkg = { ...pkgJson };
    delete pkg.version;
    assert.deepStrictEqual(validatePackageJson("hapi", pkg, []), [
      `hapi's package.json should have \`"version"\` matching the version of the implementation package.`,
    ]);
  });
  it("requires version to be NN.NN.NN", () => {
    assert.deepStrictEqual(validatePackageJson("hapi", { ...pkgJson, version: "hi there" }, []), [
      `hapi's package.json has bad "version": "hi there" should look like "NN.NN.9999"`,
    ]);
  });
  it("requires version to end with .9999", () => {
    assert.deepStrictEqual(validatePackageJson("hapi", { ...pkgJson, version: "1.2.3" }, []), [
      `hapi's package.json has bad "version": 1.2.3 must end with ".9999"`,
    ]);
  });
  it("works with old-version packages", () => {
    assert.ok(!Array.isArray(validatePackageJson("hapi", { ...pkgJson, version: "16.6.9999" }, [])));
  });
});

describe("makeTypesVersionsForPackageJson", () => {
  it("is undefined for empty versions", () => {
    assert.strictEqual(makeTypesVersionsForPackageJson([]), undefined);
  });
  it("works for one version", () => {
    assert.deepStrictEqual(makeTypesVersionsForPackageJson(["4.5"]), {
      "<=4.5": {
        "*": ["ts4.5/*"],
      },
    });
  });
  it("orders versions old to new  with old-to-new input", () => {
    assert.strictEqual(
      JSON.stringify(makeTypesVersionsForPackageJson(["4.8", "5.0", "5.2"]), undefined, 4),
      `{
    "<=4.8": {
        "*": [
            "ts4.8/*"
        ]
    },
    "<=5.0": {
        "*": [
            "ts5.0/*"
        ]
    },
    "<=5.2": {
        "*": [
            "ts5.2/*"
        ]
    }
}`,
    );
  });
  it("orders versions old to new  with new-to-old input", () => {
    assert.strictEqual(
      JSON.stringify(makeTypesVersionsForPackageJson(["5.2", "5.0", "4.8"]), undefined, 4),
      `{
    "<=4.8": {
        "*": [
            "ts4.8/*"
        ]
    },
    "<=5.0": {
        "*": [
            "ts5.0/*"
        ]
    },
    "<=5.2": {
        "*": [
            "ts5.2/*"
        ]
    }
}`,
    );
  });
});

describe("getLicenseFromPackageJson", () => {
  it("returns MIT by default", () => {
    assert.strictEqual(getLicenseFromPackageJson(undefined), License.MIT);
  });

  it("throws if license is MIT", () => {
    assert.deepStrictEqual(getLicenseFromPackageJson("MIT"), [
      'Specifying \'"license": "MIT"\' is redundant, this is the default.',
    ]);
  });

  it("returns known licenses", () => {
    assert.strictEqual(getLicenseFromPackageJson(License.Apache20), License.Apache20);
  });

  it("throws if unknown license", () => {
    assert.deepStrictEqual(getLicenseFromPackageJson("nonsense"), [
      `'package.json' license is "nonsense".
Expected one of: ["MIT","Apache-2.0"]}`,
    ]);
  });
});
