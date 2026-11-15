import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFakeStdioChild, StdioJsonRpcSession, StdioWaitError } from "./stdio-wait.js";

describe("StdioJsonRpcSession wait cleanup", () => {
  it("rejects with a clear timeout error and clears timers when the response is missing", async () => {
    const fake = createFakeStdioChild();
    const session = new StdioJsonRpcSession(fake.child, { timeoutMs: 40, pollMs: 5 });
    const started = Date.now();
    await assert.rejects(
      () => session.waitForResponse(99),
      (err: unknown) => {
        assert.ok(err instanceof StdioWaitError);
        assert.equal(err.causeKind, "timeout");
        assert.match(err.message, /Timed out waiting for id 99/);
        return true;
      },
    );
    assert.ok(Date.now() - started < 500, "timeout path must finish quickly");
    assert.equal(session.pendingTimerCount, 0);
    assert.equal(session.pendingWaitCount, 0);
    await session.dispose();
    assert.equal(session.pendingTimerCount, 0);
  });

  it("rejects on parse error and clears pending waits", async () => {
    const fake = createFakeStdioChild();
    const session = new StdioJsonRpcSession(fake.child, { timeoutMs: 2000, pollMs: 5 });
    const pending = session.waitForResponse(1);
    fake.pushStdout("not-json\n");
    await assert.rejects(
      () => pending,
      (err: unknown) => {
        assert.ok(err instanceof StdioWaitError);
        assert.equal(err.causeKind, "parse");
        return true;
      },
    );
    assert.equal(session.pendingWaitCount, 0);
    await session.dispose();
  });

  it("rejects when the child exits before the response arrives", async () => {
    const fake = createFakeStdioChild();
    const session = new StdioJsonRpcSession(fake.child, { timeoutMs: 2000, pollMs: 5 });
    const pending = session.waitForResponse(7);
    fake.close(1);
    await assert.rejects(
      () => pending,
      (err: unknown) => {
        assert.ok(err instanceof StdioWaitError);
        assert.equal(err.causeKind, "exit");
        return true;
      },
    );
    assert.equal(session.pendingWaitCount, 0);
    await session.dispose();
  });

  for (const { label, output, message } of [
    { label: "a non-JSON-RPC line", output: "invalid stdout\n", message: /non-JSON-RPC stdout line/ },
    { label: "an unterminated line", output: "invalid stdout", message: /unterminated line/ },
  ]) {
    it(`rejects ${label} after a valid check response`, async () => {
      const fake = createFakeStdioChild();
      const session = new StdioJsonRpcSession(fake.child);
      try {
        fake.pushStdout('{"jsonrpc":"2.0","id":2,"result":{"isError":false}}\n');
        assert.equal((await session.waitForResponse(2)).id, 2);

        const finished = session.finish();
        fake.pushStdout(output);
        fake.close();
        await assert.rejects(finished, { causeKind: "parse", message });
      } finally {
        await session.dispose();
      }
    });
  }

  it("rejects a nonzero exit after a valid response", async () => {
    const fake = createFakeStdioChild();
    const session = new StdioJsonRpcSession(fake.child);
    try {
      fake.pushStdout('{"jsonrpc":"2.0","id":2,"result":{"isError":false}}\n');
      assert.equal((await session.waitForResponse(2)).id, 2);

      const finished = session.finish();
      fake.close(1);
      await assert.rejects(finished, { causeKind: "exit", message: /exited with code 1/ });
    } finally {
      await session.dispose();
    }
  });
});
