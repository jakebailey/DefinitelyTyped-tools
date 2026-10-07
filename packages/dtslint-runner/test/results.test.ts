import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { setImmediate } from "node:timers/promises";
import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { addGithubLinks, Failure } from "../src/add-github-links";
import { getDiffComment, getDiffLog, getResultComments, main } from "../src/post-results";

type CommentsClient = NonNullable<Parameters<typeof main>[0]>;

const repoUrl = "https://github.com/DefinitelyTyped/DefinitelyTyped";
let checkout: string;
let commit: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: checkout, encoding: "utf8" }).trim();
}

function writeFile(path: string, contents = ""): string {
  const file = join(checkout, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
  return file;
}

before(() => {
  checkout = mkdtempSync(join(tmpdir(), "dt-result-links-"));
  git("init", "--quiet");
  writeFile("types/example/package.json", "{}");
  writeFile("types/example/tsconfig.json", "{}");
  writeFile("types/example/index.d.ts", "export {};\n");
  writeFile("types/example/example-tests.ts", "export {};\n");
  writeFile("types/example/v1/package.json", '{"tsconfigs":["tsconfig.json","tsconfig.other.json"]}');
  writeFile("types/example/v1/tsconfig.json", "{}");
  writeFile("types/example/v1/tsconfig.other.json", "{}");
  writeFile("types/example/v1/index.d.ts", "export {};\n");
  writeFile("types/dependency/package.json", "{}");
  writeFile("types/dependency/index.d.ts", "export {};\n");
  git("add", ".");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-m",
    "Fixture",
  );
  commit = git("rev-parse", "HEAD");
  git("remote", "add", "origin", `${repoUrl}.git`);
  git("update-ref", "refs/remotes/origin/master", commit);
  git("checkout", "--quiet", "--detach", commit);
  writeFile("types/example/untracked.ts");
  writeFile("types/example/node_modules/external/index.d.ts");
  writeFile("compiler/lib.d.ts");
  symlinkSync(join(checkout, "types/dependency"), join(checkout, "types/example/node_modules/dependency"), "dir");
});

after(() => {
  rmSync(checkout, { recursive: true, force: true });
});

test("adds pinned package and Corsa diagnostic links without changing the raw errors", async () => {
  const file = join(checkout, "types/example/example-tests.ts");
  const error = `${file}:12:3\nTypeScript@local compile error TS2322: Type '<T>' is not assignable.\n\nindex.d.ts:2:1\nExpected type.`;
  const failures: Failure[] = [{ path: "example", error }];
  await addGithubLinks(failures, checkout);
  assert.equal(failures[0].error, error);
  assert.equal(failures[0].packageUrl, `${repoUrl}/tree/${commit}/types/example`);
  assert.deepEqual(
    failures[0].errorLinks?.map(({ start, end, url }) => [error.slice(start, end), url]),
    [
      [`${file}:12:3`, `${repoUrl}/blob/${commit}/types/example/example-tests.ts#L12`],
      ["index.d.ts:2:1", `${repoUrl}/blob/${commit}/types/example/index.d.ts#L2`],
    ],
  );
  const comment = getDiffComment([], failures)!;
  assert.ok(comment.includes(`<code><a href="${repoUrl}/tree/${commit}/types/example">example</a></code>`));
  assert.ok(
    comment.includes(`<pre><a href="${repoUrl}/blob/${commit}/types/example/example-tests.ts#L12">${file}:12:3</a>`),
  );
  assert.ok(comment.includes("Type '&lt;T&gt;' is not assignable."));
});

test("links ESLint stylish headers and individual error lines, including CRLF", async () => {
  const file = join(checkout, "types/example/index.d.ts");
  const error = `\r\n${file}\r\n  2:3  error  First error\r\n       With elaboration\r\n  4:5  warning  Second error\r\n\r\n2 problems`;
  const failures: Failure[] = [{ path: "example", error }];
  await addGithubLinks(failures, checkout);
  assert.deepEqual(
    failures[0].errorLinks?.map(({ start, end, url }) => [error.slice(start, end), url]),
    [
      [file, `${repoUrl}/blob/${commit}/types/example/index.d.ts`],
      ["2:3", `${repoUrl}/blob/${commit}/types/example/index.d.ts#L2`],
      ["4:5", `${repoUrl}/blob/${commit}/types/example/index.d.ts#L4`],
    ],
  );
});

test("resolves versioned packages, workspace dependencies, and tsc locations", async () => {
  const failures: Failure[] = [
    { path: "example/v1", error: "index.d.ts(3,4): error TS2322: Example" },
    { path: "example", error: "node_modules/dependency/index.d.ts:5:6\nExample" },
  ];
  await addGithubLinks(failures, checkout);
  assert.equal(failures[0].packageUrl, `${repoUrl}/tree/${commit}/types/example/v1`);
  assert.equal(failures[0].errorLinks?.[0].url, `${repoUrl}/blob/${commit}/types/example/v1/index.d.ts#L3`);
  assert.equal(failures[1].errorLinks?.[0].url, `${repoUrl}/blob/${commit}/types/dependency/index.d.ts#L5`);
});

test("leaves untracked, missing, installed, and external files unlinked", async () => {
  const failures: Failure[] = [
    {
      path: "example",
      error: [
        "untracked.ts:1:1",
        "missing.ts:1:1",
        "node_modules/external/index.d.ts:1:1",
        `${join(checkout, "compiler/lib.d.ts")}:1:1`,
        "Out of memory",
      ].join("\n"),
    },
  ];
  await addGithubLinks(failures, checkout);
  assert.deepEqual(failures[0].errorLinks, []);
  const comment = getDiffComment([], failures);
  assert.ok(comment);
  assert.ok(comment.includes(`<pre>${failures[0].error}</pre>`));
});

test("handles empty failure lists and fails explicitly when the checkout has no GitHub remote", async () => {
  assert.equal(await addGithubLinks([], checkout), undefined);
  git("remote", "remove", "origin");
  try {
    await assert.rejects(
      addGithubLinks([{ path: "example", error: "Out of memory" }], checkout),
      /not present on any remote/,
    );
  } finally {
    git("remote", "add", "origin", `${repoUrl}.git`);
    git("update-ref", "refs/remotes/origin/master", commit);
  }
});

test("compares only raw errors, not link metadata", () => {
  assert.equal(
    getDiffComment(
      [{ path: "example", error: "same" }],
      [{ path: "example", error: "same", packageUrl: `${repoUrl}/tree/different/types/example`, errorLinks: [] }],
    ),
    undefined,
  );
  assert.equal(getDiffComment([], []), undefined);
});

test("renders all three difference categories, retaining each side's links", () => {
  const mainUrl = `${repoUrl}/blob/base/types/example/index.d.ts#L1`;
  const branchUrl = `${repoUrl}/blob/head/types/example/index.d.ts#L2`;
  const comment = getDiffComment(
    [
      { path: "fixed", error: "old failure" },
      { path: "changed", error: "old", errorLinks: [{ start: 0, end: 3, url: mainUrl }] },
    ],
    [
      { path: "new", error: "new failure" },
      { path: "changed", error: "new", errorLinks: [{ start: 0, end: 3, url: branchUrl }] },
    ],
  )!;
  assert.ok(comment.includes("<summary>Branch only errors:</summary>"));
  assert.ok(comment.includes("<summary>Main only errors:</summary>"));
  assert.ok(comment.includes("<summary>Errors that changed between main and the branch:</summary>"));
  assert.ok(comment.includes(`<pre><a href="${mainUrl}">old</a></pre>`));
  assert.ok(comment.includes(`<pre><a href="${branchUrl}">new</a></pre>`));
  assert.ok(comment.includes("<pre>old failure</pre>"));
  assert.ok(comment.includes("<pre>new failure</pre>"));
});

test("escapes diagnostic HTML and refuses non-DT links", () => {
  const error = '</pre><script>alert("oops")</script>\n```\n& <T>';
  const comment = getDiffComment(
    [],
    [
      {
        path: "<example>",
        error,
        packageUrl: "javascript:alert(1)",
        errorLinks: [{ start: 0, end: 6, url: "file:///private/file" }],
      },
    ],
  )!;
  assert.ok(comment.includes("Package: <code>&lt;example&gt;</code>"));
  assert.ok(comment.includes("&lt;/pre&gt;&lt;script&gt;alert(&quot;oops&quot;)&lt;/script&gt;\n```\n&amp; &lt;T&gt;"));
  assert.ok(!comment.includes("<script>"));
  assert.ok(!comment.includes("<a "));
});

test("links project-level errors to the default and explicitly configured tsconfigs", async () => {
  const failures: Failure[] = [
    { path: "example", error: "TypeScript@local compile error TS18003: No inputs were found." },
    { path: "example/v1", error: "Project-level failure" },
  ];
  await addGithubLinks(failures, checkout);
  assert.deepEqual(failures[0].projects, [
    { path: "tsconfig.json", url: `${repoUrl}/blob/${commit}/types/example/tsconfig.json` },
  ]);
  assert.deepEqual(failures[1].projects, [
    { path: "tsconfig.json", url: `${repoUrl}/blob/${commit}/types/example/v1/tsconfig.json` },
    { path: "tsconfig.other.json", url: `${repoUrl}/blob/${commit}/types/example/v1/tsconfig.other.json` },
  ]);
  const comment = getDiffComment([], failures)!;
  assert.ok(
    comment.includes(`Project scope: <code><a href="${failures[0].projects![0].url}">tsconfig.json</a></code>`),
  );
  assert.ok(comment.includes(`href="${failures[1].projects![1].url}"`));
});

test("logs full raw diagnostics and explicit URLs instead of HTML or Markdown", async () => {
  const error = "index.d.ts:2:1\nType <T> & Other\n##vso[task.setvariable variable=foo]bar";
  const failures: Failure[] = [{ path: "example", error }];
  await addGithubLinks(failures, checkout);
  const log = getDiffLog([], failures);
  assert.ok(log.includes("Type <T> & Other"));
  assert.ok(log.includes(`index.d.ts:2:1 -> ${repoUrl}/blob/${commit}/types/example/index.d.ts#L2`));
  assert.ok(log.includes(`Project: tsconfig.json\n  ${repoUrl}/blob/${commit}/types/example/tsconfig.json`));
  assert.doesNotMatch(log, /<pre>|<a href|<details>|&lt;/);
  assert.ok(!log.includes("##vso["));
  assert.ok(log.includes("# #vso[task.setvariable variable=foo]bar"));
  assert.equal(
    log.split("\n").every((line) => !line || line.startsWith("  ")),
    true,
  );
  assert.equal(getDiffLog(failures, failures), "");
});

const logUrl = "https://dev.azure.com/example/project/_build/results?buildId=123&view=logs";

function expectBalancedComments(comments: string[]) {
  for (const comment of comments) {
    assert.ok(comment.length <= 65535);
    for (const tag of ["details", "pre", "code", "a"]) {
      assert.equal(
        comment.match(new RegExp(`<${tag}(?:>| )`, "g"))?.length ?? 0,
        comment.match(new RegExp(`</${tag}>`, "g"))?.length ?? 0,
      );
    }
    assert.ok(comment.includes(`[Full output in the log](${logUrl}).`));
  }
}

test("paginates at package boundaries without losing any reports", () => {
  const failures = Array.from({ length: 8 }, (_, i) => ({ path: `package-${i}`, error: `${i}:` + "x".repeat(20000) }));
  const comments = getResultComments([], failures, "tester", logUrl);
  assert.ok(comments.length > 1);
  expectBalancedComments(comments);
  assert.ok(comments[0].includes("the results of running"));
  assert.ok(comments[1].includes("here are more DT test results"));
  const combined = comments.join("\n");
  for (const failure of failures) {
    assert.equal(combined.split(`Package: <code>${failure.path}</code>`).length, 2);
    assert.ok(combined.includes(failure.error));
  }
  assert.ok(!combined.includes("truncated"));
});

test("fits the exact comment limit and starts a new comment when adding another report", () => {
  const failure = { path: "exact", error: "" };
  const overhead = getResultComments([], [failure], "tester", logUrl)[0].length;
  failure.error = "x".repeat(65535 - overhead);
  const comments = getResultComments([], [failure, { path: "next", error: "next" }], "tester", logUrl);
  assert.equal(comments.length, 2);
  assert.equal(comments[0].length, 65535);
  assert.ok(!comments[0].includes("truncated"));
  expectBalancedComments(comments);
});

test("safely truncates oversized individual reports but retains full linked output in logs", () => {
  const url = `${repoUrl}/blob/${"a".repeat(40)}/types/example/index.d.ts#L1`;
  const failure: Failure = {
    path: "huge",
    error: 'index.d.ts:1:1\n<&"😀>'.repeat(20000),
    errorLinks: [{ start: 0, end: "index.d.ts:1:1".length, url }],
  };
  const comments = getResultComments([], [failure, { path: "next", error: "still included" }], "tester", logUrl);
  assert.equal(comments.length, 2);
  expectBalancedComments(comments);
  assert.ok(comments[0].includes(`<a href="${url}">index.d.ts:1:1</a>`));
  assert.ok(comments[0].includes("&lt;&amp;&quot;😀&gt;"));
  assert.ok(comments[0].includes("[... truncated ...]"));
  assert.ok(comments[0].includes("This package report was truncated"));
  assert.equal(Buffer.from(comments[0]).toString("utf8"), comments[0]);
  assert.ok(comments[1].includes("still included"));
  const log = getDiffLog([], [failure]);
  assert.ok(log.includes(failure.error.split("\n").join("\n  ")));
  assert.ok(log.includes(url));
  assert.ok(!log.includes("truncated"));
});

test("keeps both sides and balanced markup when a changed report exceeds the limit", () => {
  const comments = getResultComments(
    [{ path: "changed", error: "<old>".repeat(20000) }],
    [{ path: "changed", error: "<new>".repeat(20000) }],
    "tester",
    logUrl,
  );
  assert.equal(comments.length, 1);
  expectBalancedComments(comments);
  assert.ok(comments[0].includes("Main error:"));
  assert.ok(comments[0].includes("Branch error:"));
  assert.ok(comments[0].includes("&lt;old&gt;"));
  assert.ok(comments[0].includes("&lt;new&gt;"));
});

for (const row of [
  { scenario: "branch-only errors across multiple chunks", kind: "new", emoji: "👀", count: 4 },
  { scenario: "main-only errors", kind: "fixed", emoji: "✅", count: 1 },
  { scenario: "changed errors", kind: "changed", emoji: "👀", count: 1 },
  { scenario: "unchanged errors", kind: "same", emoji: "✅", count: 1 },
  { scenario: "no errors", kind: "empty", emoji: "✅", count: 1 },
  { scenario: "infrastructure failure", kind: "fail", emoji: "❌", count: 1 },
] as const) {
  test(`posts results and updates the status for ${row.scenario}`, async (t) => {
    const { kind, emoji, count } = row;
    const args = process.argv;
    const env = { ...process.env };
    const consoleLog = t.mock.method(console, "log", () => {});
    const consoleError = t.mock.method(console, "error", () => {});
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const failures = Array.from({ length: 4 }, (_, i) => ({ path: `package-${i}`, error: "x".repeat(40000) }));
    const oldError = { path: "example", error: "old error" };
    const mainFailures = ["fixed", "changed", "same"].includes(kind) ? [oldError] : [];
    const branchFailures =
      kind === "new"
        ? failures
        : kind === "changed"
          ? [{ path: "example", error: "new error" }]
          : kind === "same"
            ? [oldError]
            : [];
    writeFile("results/pr/failures.json", JSON.stringify(branchFailures));
    writeFile("results/main/failures.json", JSON.stringify(mainFailures));
    process.argv = [
      "node",
      "post-results",
      "fake-token",
      "123",
      "456",
      "tester",
      "789",
      "test-run",
      kind === "fail" ? "fail" : "ok",
      join(checkout, "results/main"),
      join(checkout, "results/pr"),
    ];
    process.env.SYSTEM_COLLECTIONURI = "https://dev.azure.com/example/";
    process.env.SYSTEM_TEAMPROJECT = "project";
    process.env.SYSTEM_JOBID = "job";
    process.env.SYSTEM_TASKINSTANCEID = "task";
    let commentCount = 0;
    const mockCreateComment = t.mock.fn<CommentsClient["createComment"]>(async () => ({
      data: {
        html_url: `https://github.com/microsoft/TypeScript/issues/789#issuecomment-${++commentCount}`,
      },
    }));
    let statusReads = 0;
    const mockGetComment = t.mock.fn<CommentsClient["getComment"]>(async () => ({
      data: { body: statusReads++ === 0 ? "Status: <!--result-test-run-->" : "Status: updated" },
    }));
    const mockUpdateComment = t.mock.fn<CommentsClient["updateComment"]>(async () => ({}));
    const commentsClient: CommentsClient = {
      createComment: mockCreateComment,
      getComment: mockGetComment,
      updateComment: mockUpdateComment,
    };
    try {
      const result = main(commentsClient);
      await setImmediate();
      assert.equal(mockGetComment.mock.callCount(), 1);
      assert.equal(mockUpdateComment.mock.callCount(), 1);
      t.mock.timers.tick(999);
      await setImmediate();
      assert.equal(mockGetComment.mock.callCount(), 1);
      t.mock.timers.tick(1);
      await result;
      assert.equal(mockGetComment.mock.callCount(), 2);
      assert.equal(consoleError.mock.callCount(), 0);
      assert.equal(mockCreateComment.mock.callCount(), count);
      const bodies = mockCreateComment.mock.calls.map((call) => call.arguments[0].body);
      assert.equal(
        bodies.every((body) => body.length <= 65535),
        true,
      );
      const status = mockUpdateComment.mock.calls[0].arguments[0].body;
      assert.ok(status);
      assert.ok(status.includes(`[${emoji} Results]`));
      for (let i = 1; i <= count; i++) {
        assert.ok(status.includes(`https://github.com/microsoft/TypeScript/issues/789#issuecomment-${i}`));
      }
      if (kind === "new") {
        assert.ok(bodies.join("\n").includes("&j=job&t=task"));
        assert.ok(status.includes("Part 4"));
        assert.ok(consoleLog.mock.calls[0].arguments[0].includes("Branch only errors:"));
        assert.ok(!consoleLog.mock.calls[0].arguments[0].includes("<pre>"));
      }
      if (kind === "fixed") {
        assert.ok(bodies[0].includes("Main only errors:"));
        assert.ok(bodies[0].includes(oldError.error));
      }
    } finally {
      process.argv = args;
      process.env = env;
    }
  });
}
