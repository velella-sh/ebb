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
});
