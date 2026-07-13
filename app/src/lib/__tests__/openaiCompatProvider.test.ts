import { describe, it, expect, afterEach, vi } from "vitest";
import { OpenAiCompatProvider } from "@/lib/providers/openaiCompatProvider";
import { ProviderTransientError } from "@/lib/providers/provider";
import { getProvider, resetProviderCache } from "@/lib/providers/index";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenAiCompatProvider", () => {
  it("maps a happy-path chat-completions response", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://example.test/v1/chat/completions");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-key-123");
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        model: "test-model",
        messages: [{ role: "user", content: "hello" }],
      });
      return jsonResponse(200, {
        choices: [{ message: { content: "hi there" } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      });
    });

    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key-123",
      model: "test-model",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await provider.complete({ prompt: "hello" });
    expect(result).toEqual({
      raw: "hi there",
      tokensIn: 5,
      tokensOut: 3,
      costEstimate: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("strips a trailing slash from baseUrl", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://example.test/v1/chat/completions");
      return jsonResponse(200, {
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
    });
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1/",
      apiKey: "k",
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await provider.complete({ prompt: "x" });
  });

  it("throws ProviderTransientError on 429", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, { error: "rate limited" }));
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(ProviderTransientError);
  });

  it("throws ProviderTransientError on 500", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: "boom" }));
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(ProviderTransientError);
  });

  it("throws ProviderTransientError on 408", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(408, { error: "timeout" }));
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(ProviderTransientError);
  });

  it("throws a permanent error on 401 that does not leak the API key", async () => {
    const secret = "super-secret-key-should-not-leak";
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: "unauthorized" }));
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: secret,
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    let caught: unknown;
    try {
      await provider.complete({ prompt: "x" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(ProviderTransientError);
    const message = (caught as Error).message;
    expect(message).not.toContain(secret);
    expect(message).toMatch(/401/);
  });

  it("throws a permanent error on 403 (no key leak)", async () => {
    const secret = "another-secret-key";
    const fetchImpl = vi.fn(async () => jsonResponse(403, { error: "forbidden" }));
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: secret,
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const err = await provider.complete({ prompt: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ProviderTransientError);
    expect((err as Error).message).not.toContain(secret);
  });

  it("throws a permanent error on 400", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { error: "bad request" }));
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const err = await provider.complete({ prompt: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ProviderTransientError);
  });

  it("throws ProviderTransientError on abort/timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    );
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      model: "m",
      timeoutMs: 5,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(ProviderTransientError);
  });

  it("throws ProviderTransientError on a raw network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(ProviderTransientError);
  });

  it("throws a clear error when the response is missing message content", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { choices: [{ message: {} }] }));
    const provider = new OpenAiCompatProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      model: "m",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(/missing/);
  });

  it("constructor validates required options", () => {
    expect(() => new OpenAiCompatProvider({ baseUrl: "", apiKey: "k", model: "m" })).toThrow();
    expect(() => new OpenAiCompatProvider({ baseUrl: "b", apiKey: "", model: "m" })).toThrow();
    expect(() => new OpenAiCompatProvider({ baseUrl: "b", apiKey: "k", model: "" })).toThrow();
  });
});

describe("getProvider() live mode + config errors", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetProviderCache();
  });

  it("defaults to mock mode when PROVIDER_MODE is unset", () => {
    delete process.env.PROVIDER_MODE;
    resetProviderCache();
    const provider = getProvider();
    expect(provider.constructor.name).toBe("MockLlmProvider");
  });

  it("throws a helpful error listing missing env vars in live mode", () => {
    process.env.PROVIDER_MODE = "live";
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
    resetProviderCache();
    expect(() => getProvider()).toThrow(/LLM_BASE_URL/);
    try {
      getProvider();
    } catch (err) {
      expect((err as Error).message).toContain("LLM_BASE_URL");
      expect((err as Error).message).toContain("LLM_API_KEY");
      expect((err as Error).message).toContain("LLM_MODEL");
    }
  });

  it("throws listing only the missing var(s) when some are present", () => {
    process.env.PROVIDER_MODE = "live";
    process.env.LLM_BASE_URL = "https://example.test/v1";
    process.env.LLM_API_KEY = "k";
    delete process.env.LLM_MODEL;
    resetProviderCache();
    let message = "";
    try {
      getProvider();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("LLM_MODEL");
    expect(message).not.toContain("LLM_BASE_URL,");
  });

  it("constructs an OpenAiCompatProvider in live mode when all env vars are present", () => {
    process.env.PROVIDER_MODE = "live";
    process.env.LLM_BASE_URL = "https://example.test/v1";
    process.env.LLM_API_KEY = "k";
    process.env.LLM_MODEL = "test-model";
    resetProviderCache();
    const provider = getProvider();
    expect(provider.constructor.name).toBe("OpenAiCompatProvider");
  });

  it("throws a helpful error for an unsupported mode", () => {
    process.env.PROVIDER_MODE = "bogus";
    resetProviderCache();
    expect(() => getProvider()).toThrow(/bogus/);
  });

  it("caches the provider instance across calls", () => {
    delete process.env.PROVIDER_MODE;
    resetProviderCache();
    const a = getProvider();
    const b = getProvider();
    expect(a).toBe(b);
  });
});
