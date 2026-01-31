import { it, TestContext } from "node:test";

export function testo(o: { [s: string]: (t: TestContext) => void | Promise<void> }) {
  for (const k of Object.keys(o)) {
    it(k, { timeout: 100_000 }, o[k]);
  }
}
