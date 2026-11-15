/**
 * JSON-RPC stdio wait helper for MCP packed tests.
 * Guarantees timers and listeners are cleared on settle, timeout, parse error, or child exit.
 */

import { EventEmitter, once } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

export class StdioWaitError extends Error {
  constructor(
    message: string,
    readonly causeKind: "timeout" | "parse" | "exit" | "spawn",
  ) {
    super(message);
    this.name = "StdioWaitError";
  }
}

export interface StdioJsonRpcSessionOptions {
  timeoutMs?: number;
  pollMs?: number;
}

type JsonRpcMessage = { jsonrpc?: string; id?: string | number };

/**
 * Owns one MCP child process's stdout/stderr parsing and response waits.
 */
type PendingWait = {
  reject: (err: StdioWaitError) => void;
  cleanup: () => void;
};

export class StdioJsonRpcSession {
  private readonly responses: JsonRpcMessage[] = [];
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly pendingWaits = new Set<PendingWait>();
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private rawStdout = "";
  private closed = false;
  private exitCode: number | null = null;
  private fatal: StdioWaitError | undefined;
  private readonly onData: (chunk: Buffer) => void;
  private readonly onErr: (chunk: Buffer) => void;
  private readonly onClose: (code: number | null) => void;
  private readonly onError: (err: Error) => void;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly options: StdioJsonRpcSessionOptions = {},
  ) {
    this.onData = (chunk: Buffer) => {
      try {
        this.ingestStdout(chunk.toString("utf8"));
      } catch (err) {
        this.fail(
          err instanceof StdioWaitError
            ? err
            : new StdioWaitError(err instanceof Error ? err.message : String(err), "parse"),
        );
      }
    };
    this.onErr = (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString("utf8");
    };
    this.onClose = (code) => {
      this.closed = true;
      this.exitCode = code;
      if (this.pendingWaits.size > 0) {
        this.fail(new StdioWaitError(`MCP child exited before response (code ${code})`, "exit"));
      }
    };
    this.onError = (err) => {
      this.fail(new StdioWaitError(`MCP child spawn/error: ${err.message}`, "spawn"));
    };

    this.child.stdout.on("data", this.onData);
    this.child.stderr.on("data", this.onErr);
    this.child.on("close", this.onClose);
    this.child.on("error", this.onError);
  }

  get stderr(): string {
    return this.stderrBuffer;
  }

  get stdoutRaw(): string {
    return this.rawStdout;
  }

  get allResponses(): readonly JsonRpcMessage[] {
    return this.responses;
  }

  /** Exposed for regression tests that assert cleanup. */
  get pendingTimerCount(): number {
    return this.timers.size;
  }

  get pendingWaitCount(): number {
    return this.pendingWaits.size;
  }

  write(message: unknown): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  async finish(): Promise<void> {
    const timeoutMs = this.options.timeoutMs ?? 10000;
    if (!this.closed && !this.fatal) {
      const signal = AbortSignal.timeout(timeoutMs);
      // Register before ending stdin so close is observed even if the child exits immediately.
      const close = once(this.child, "close", { signal });
      this.child.stdin.end();
      try {
        await close;
      } catch (err) {
        if (signal.aborted) {
          throw new StdioWaitError(`Timed out waiting for MCP child to close after ${timeoutMs}ms`, "timeout");
        }
        throw this.fatal ?? err;
      }
    }

    if (this.fatal) throw this.fatal;
    if (this.stdoutBuffer) {
      throw new StdioWaitError(
        `MCP stdout ended with an unterminated line: ${JSON.stringify(this.stdoutBuffer)}`,
        "parse",
      );
    }
    if (this.exitCode !== 0) {
      throw new StdioWaitError(`MCP child exited with code ${this.exitCode}`, "exit");
    }
  }

  waitForResponse(id: string | number): Promise<JsonRpcMessage> {
    if (this.fatal) {
      return Promise.reject(this.fatal);
    }
    if (this.closed) {
      return Promise.reject(
        new StdioWaitError(`MCP child already exited (code ${this.exitCode}) while waiting for id ${id}`, "exit"),
      );
    }

    const existing = this.responses.find((r) => r.id === id);
    if (existing) {
      return Promise.resolve(existing);
    }

    const timeoutMs = this.options.timeoutMs ?? 10000;
    const pollMs = this.options.pollMs ?? 10;

    return new Promise<JsonRpcMessage>((resolve, reject) => {
      let settled = false;
      let pollTimer: NodeJS.Timeout | undefined;
      let pending: PendingWait;

      const clearPoll = () => {
        if (pollTimer !== undefined) {
          clearTimeout(pollTimer);
          this.timers.delete(pollTimer);
          pollTimer = undefined;
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.timers.delete(timeout);
        clearPoll();
        this.pendingWaits.delete(pending);
      };

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      pending = {
        cleanup,
        reject: (err) => {
          settle(() => reject(err));
        },
      };

      const timeout = setTimeout(() => {
        settle(() => {
          reject(
            new StdioWaitError(
              `Timed out waiting for id ${id} after ${timeoutMs}ms. responses=${JSON.stringify(this.responses)} stderr=${this.stderrBuffer} stdout=${this.rawStdout}`,
              "timeout",
            ),
          );
        });
      }, timeoutMs);
      this.timers.add(timeout);

      const poll = () => {
        if (settled) return;
        if (this.fatal) {
          settle(() => reject(this.fatal as StdioWaitError));
          return;
        }
        const found = this.responses.find((r) => r.id === id);
        if (found) {
          settle(() => resolve(found));
          return;
        }
        if (this.closed) {
          settle(() =>
            reject(new StdioWaitError(`MCP child exited (code ${this.exitCode}) while waiting for id ${id}`, "exit")),
          );
          return;
        }
        clearPoll();
        pollTimer = setTimeout(poll, pollMs);
        this.timers.add(pollTimer);
      };

      this.pendingWaits.add(pending);
      poll();
    });
  }

  /** Clear timers/listeners and kill the child if still running. */
  async dispose(signal: NodeJS.Signals = "SIGKILL"): Promise<void> {
    for (const wait of [...this.pendingWaits]) {
      wait.cleanup();
    }
    this.pendingWaits.clear();
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    this.child.stdout.off("data", this.onData);
    this.child.stderr.off("data", this.onErr);
    this.child.off("close", this.onClose);
    this.child.off("error", this.onError);

    if (!this.closed && this.child.exitCode === null && !this.child.killed) {
      this.child.kill(signal);
      await new Promise<void>((resolve) => {
        const force = setTimeout(() => resolve(), 1000);
        this.child.once("close", () => {
          clearTimeout(force);
          resolve();
        });
      });
    }
  }

  private fail(error: StdioWaitError): void {
    if (this.fatal) return;
    this.fatal = error;
    for (const wait of [...this.pendingWaits]) {
      wait.reject(error);
    }
  }

  private ingestStdout(text: string): void {
    this.rawStdout += text;
    this.stdoutBuffer += text;
    const lines = this.stdoutBuffer.split("\n");
    this.stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new StdioWaitError(`non-JSON-RPC stdout line from ebb mcp: ${JSON.stringify(line)}`, "parse");
      }
      if (typeof parsed !== "object" || parsed === null) {
        throw new StdioWaitError(`stdout line is not a JSON object: ${line}`, "parse");
      }
      const msg = parsed as JsonRpcMessage;
      if (msg.jsonrpc !== "2.0") {
        throw new StdioWaitError(`stdout line missing jsonrpc 2.0: ${line}`, "parse");
      }
      this.responses.push(msg);
    }
  }
}

/** Test-only: a fake child used to prove timeout cleanup without starting MCP. */
export function createFakeStdioChild(): {
  child: ChildProcessWithoutNullStreams;
  pushStdout: (chunk: string) => void;
  close: (code?: number) => void;
} {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = new EventEmitter() as unknown as ChildProcessWithoutNullStreams & {
    killed: boolean;
    exitCode: number | null;
  };
  const mutable = child as unknown as {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: (...args: unknown[]) => boolean; end: () => void };
    kill: ChildProcessWithoutNullStreams["kill"];
  };
  mutable.stdout = stdout;
  mutable.stderr = stderr;
  mutable.stdin = {
    write: () => true,
    end: () => undefined,
  };
  child.killed = false;
  child.exitCode = null;
  mutable.kill = ((signal?: NodeJS.Signals | number) => {
    void signal;
    child.killed = true;
    queueMicrotask(() => {
      child.exitCode = 1;
      child.emit("close", 1);
    });
    return true;
  }) as ChildProcessWithoutNullStreams["kill"];

  return {
    child,
    pushStdout: (chunk: string) => {
      stdout.emit("data", Buffer.from(chunk));
    },
    close: (code = 0) => {
      child.exitCode = code;
      child.emit("close", code);
    },
  };
}
