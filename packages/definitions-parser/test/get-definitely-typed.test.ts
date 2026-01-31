import assert from "node:assert";
import { getDefinitelyTyped } from "../src/get-definitely-typed";
import { quietLoggerWithErrors, Dir, FS, InMemoryFS } from "@definitelytyped/utils";
import { testo } from "./utils";

testo({
  async downloadDefinitelyTyped() {
    const dt = await getDefinitelyTyped(
      {
        definitelyTypedPath: undefined,
        progress: false,
      },
      quietLoggerWithErrors()[0],
    );
    assert.strictEqual(dt.exists("types"), true);
    assert.strictEqual(dt.exists("buncho"), false);
  },
  createDirs() {
    const root = new Dir(undefined);
    root.set("file1.txt", "ok");
    assert.strictEqual(root.has("file1.txt"), true);
    assert.strictEqual(root.get("file1.txt"), "ok");
  },
  simpleMemoryFS() {
    const root = new Dir(undefined);
    root.set("file1.txt", "ok");
    const dir = root.subdir("sub1");
    dir.set("file2.txt", "x");
    const fs: FS = new InMemoryFS(root, "/test/");
    assert.strictEqual(fs.exists("file1.txt"), true);
    assert.strictEqual(fs.readFile("file1.txt"), "ok");
    assert.strictEqual(fs.readFile("sub1/file2.txt"), "x");
  },
});
