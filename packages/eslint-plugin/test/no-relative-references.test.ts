import { runTestsWithFixtures } from "./fixtureTester";
import * as noRelativeReferences from "../src/rules/no-relative-references";

runTestsWithFixtures("@definitelytyped/no-relative-references", noRelativeReferences, {
  valid: [
    {
      filename: "types/foo/index.d.ts",
    },
  ],
  invalid: [
    {
      filename: "types/no-relative-references/index.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../foo/index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../foo" } },
      ],
    },
    {
      filename: "types/no-relative-references/v1/index.d.ts",
      errors: [
        { messageId: "relativeReference", data: { text: "../../foo/index.d.ts" } },
        { messageId: "relativeReference", data: { text: "../index.d.ts" } },
        { messageId: "relativeImport", data: { text: "../../foo" } },
        { messageId: "relativeImport", data: { text: "../index" } },
      ],
    },
  ],
});