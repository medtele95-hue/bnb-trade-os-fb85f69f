import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock supabaseAdmin before any imports that use it.
// All DB calls are intercepted — no real Supabase connections are made.
vi.mock("@/integrations/supabase/client.server", () => {
  const selectFn = vi.fn().mockResolvedValue({ data: [{ id: "1" }], error: null });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const upsertFn = vi.fn().mockReturnValue({ select: selectFn });
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    select: selectFn,
  });
  const fromFn = vi.fn().mockReturnValue({
    insert: insertFn,
    upsert: upsertFn,
    update: updateFn,
  });
  // rpc returns a list of known columns so getLiveColumns falls back to spec.columns
  const rpcFn = vi.fn().mockResolvedValue({
    data: ["id", "created_at", "level", "message", "source", "context", "raw_payload"],
    error: null,
  });
  return { supabaseAdmin: { from: fromFn, rpc: rpcFn } };
});

// Prevent TanStack router from doing real route registration.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}));

import { handleHermesPost } from "../hermes-ingest";

const VALID_SECRET = "test-secret-abc123";

function makeRequest(body: unknown, secret?: string, ip?: string): Request {
  return new Request("http://localhost/api/public/hermes-ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret !== undefined ? { "x-hermes-secret": secret } : {}),
      ...(ip ? { "CF-Connecting-IP": ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.HERMES_INGEST_SECRET = VALID_SECRET;
});

describe("handleHermesPost — auth & validation", () => {
  it("returns 401 when x-hermes-secret header is missing", async () => {
    const res = await handleHermesPost({
      request: makeRequest({ table: "bot_logs", data: { message: "hi", level: "info" } }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 when x-hermes-secret is wrong", async () => {
    const res = await handleHermesPost({
      request: makeRequest({ table: "bot_logs", data: { message: "hi" } }, "wrong-secret"),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when HERMES_INGEST_SECRET env var is not set", async () => {
    delete process.env.HERMES_INGEST_SECRET;
    const res = await handleHermesPost({
      request: makeRequest({ table: "bot_logs", data: { message: "hi" } }, VALID_SECRET),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a body that is not valid JSON", async () => {
    const req = new Request("http://localhost/api/public/hermes-ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hermes-secret": VALID_SECRET,
      },
      body: "not json {{",
    });
    const res = await handleHermesPost({ request: req });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_json");
  });

  it("returns 400 when table field is missing", async () => {
    const res = await handleHermesPost({
      request: makeRequest({ data: { message: "hi" } }, VALID_SECRET),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("returns 400 when table is not in the allowlist", async () => {
    const res = await handleHermesPost({
      request: makeRequest({ table: "users", data: { id: "1" } }, VALID_SECRET),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_table");
  });

  it("returns 400 when data is a string instead of object/array", async () => {
    const res = await handleHermesPost({
      request: makeRequest({ table: "bot_logs", data: "raw string" }, VALID_SECRET),
    });
    expect(res.status).toBe(400);
  });
});

describe("handleHermesPost — successful insert", () => {
  it("returns 200 with ok=true for a valid bot_logs insert", async () => {
    const res = await handleHermesPost({
      request: makeRequest(
        { table: "bot_logs", data: { message: "test log", level: "info", source: "test" } },
        VALID_SECRET,
      ),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.table).toBe("bot_logs");
  });

  it("returns 200 for an array of rows", async () => {
    const res = await handleHermesPost({
      request: makeRequest(
        {
          table: "bot_logs",
          data: [
            { message: "log 1", level: "info" },
            { message: "log 2", level: "warn" },
          ],
        },
        VALID_SECRET,
      ),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 200 for a bot_status upsert", async () => {
    const res = await handleHermesPost({
      request: makeRequest(
        {
          table: "bot_status",
          data: { component: "hermes_core", status: "running", mode: "PAPER" },
        },
        VALID_SECRET,
      ),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("handleHermesPost — update action", () => {
  it("returns 400 when action=update is missing match", async () => {
    const res = await handleHermesPost({
      request: makeRequest(
        { table: "bot_status", data: { status: "stopped" }, action: "update" },
        VALID_SECRET,
      ),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_match");
  });

  it("returns 400 when match object is empty", async () => {
    const res = await handleHermesPost({
      request: makeRequest(
        {
          table: "bot_status",
          data: { status: "stopped" },
          action: "update",
          match: {},
        },
        VALID_SECRET,
      ),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("empty_match");
  });
});

describe("handleHermesPost — CORS headers", () => {
  it("response always includes CORS headers", async () => {
    const res = await handleHermesPost({
      request: makeRequest({ table: "bot_logs", data: { message: "hi" } }, VALID_SECRET),
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
