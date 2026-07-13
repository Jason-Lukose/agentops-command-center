// Mock HTTP-ish tool registry for the tool_api executor. These are NOT real
// network calls — no networked services are required to run the MVP (see
// docs/ARCHITECTURE.md "External Services"). Each tool matches a URL pattern
// and returns a canned response with a simulated status code.

export interface MockToolResponse {
  status: number;
  body: unknown;
}

export interface MockToolRequest {
  method: string;
  url: string;
  input: unknown;
}

interface ToolDefinition {
  name: string;
  pattern: RegExp;
  handle(req: MockToolRequest): MockToolResponse;
}

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = (hash * 33) ^ input.charCodeAt(i);
  return Math.abs(hash);
}

const TOOLS: ToolDefinition[] = [
  {
    // GET https://mock-crm.internal/api/customers/{id}
    name: "mock-crm-lookup",
    pattern: /mock-crm\.internal\/api\/customers\/([^/?]+)/,
    handle(req) {
      const match = req.url.match(/mock-crm\.internal\/api\/customers\/([^/?]+)/);
      const customerId = match?.[1] ?? "unknown";
      const seed = hashString(customerId);
      return {
        status: 200,
        body: {
          customerId,
          name: `Customer ${seed % 1000}`,
          plan: ["Starter", "Pro", "Growth"][seed % 3],
          tenureMonths: (seed % 36) + 1,
          priorTicketCount: seed % 6,
        },
      };
    },
  },
  {
    // POST https://mock-notify.internal/api/notify
    name: "mock-notify",
    pattern: /mock-notify\.internal\/api\/notify/,
    handle() {
      return { status: 200, body: { delivered: true, deliveredAt: new Date().toISOString() } };
    },
  },
  {
    // GET https://mock-search.internal/api/search?q=...
    name: "mock-search",
    pattern: /mock-search\.internal\/api\/search/,
    handle(req) {
      const seed = hashString(req.url);
      return {
        status: 200,
        body: {
          results: [
            { id: `doc_${seed % 100}`, score: Math.round(((seed % 40) / 100 + 0.6) * 100) / 100 },
            { id: `doc_${(seed >> 3) % 100}`, score: Math.round((((seed >> 3) % 40) / 100 + 0.5) * 100) / 100 },
          ],
        },
      };
    },
  },
];

/** Simulates an HTTP call to a mock tool. Returns 404 if no tool matches the URL. */
export function callMockTool(req: MockToolRequest): MockToolResponse {
  const tool = TOOLS.find((t) => t.pattern.test(req.url));
  if (!tool) {
    return { status: 404, body: { error: `No mock tool registered for URL: ${req.url}` } };
  }
  return tool.handle(req);
}
