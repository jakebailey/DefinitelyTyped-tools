import { describe, it } from "node:test";
import assert from "node:assert";
import path from "path";
import fs from "fs";
import { list } from "tar";
import { createTgz } from "../src/io";

describe("io", () => {
  describe("createTgz", () => {
    it("packs a directory", async () => {
      const dir = path.join(__dirname, "data", "pack");
      const archivePath = path.join(__dirname, "data", "pack.tgz");

      await new Promise<void>((resolve, reject) => {
        createTgz(dir, (err) => {
          reject(err);
        })
          .pipe(fs.createWriteStream(archivePath))
          .on("finish", async () => {
            try {
              assert.strictEqual(fs.existsSync(archivePath), true);
              const entries: string[] = [];
              await list({ file: archivePath, onentry: (e) => entries.push(e.path) });
              assert.strictEqual(entries[0], "pack/");
              assert.strictEqual(entries[1], "pack/test.txt");
              resolve();
            } catch (e) {
              reject(e);
            }
          });
      });
    });
  });
});
