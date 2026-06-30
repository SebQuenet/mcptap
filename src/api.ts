import type { Store, TimelineFilters } from "./store.js";

export interface ApiResponse {
  status: number;
  body: unknown;
}

function timelineFilters(params: URLSearchParams): TimelineFilters {
  const filters: TimelineFilters = {};
  const status = params.get("status");
  if (status === "ok" || status === "error" || status === "pending") filters.status = status;
  const server = params.get("server");
  if (server) filters.serverLabel = server;
  const method = params.get("method");
  if (method) filters.method = method;
  const tool = params.get("tool");
  if (tool) filters.toolName = tool;
  const session = params.get("session");
  if (session) filters.sessionId = session;
  const search = params.get("search");
  if (search) filters.search = search;
  return filters;
}

/** Map a read-only API request to a JSON response over the local capture store. */
export function handleApiRequest(store: Store, pathname: string, params: URLSearchParams): ApiResponse {
  switch (pathname) {
    case "/api/timeline":
      return { status: 200, body: store.getTimeline(timelineFilters(params)) };
    case "/api/cost":
      return { status: 200, body: store.getCostSummary() };
    case "/api/exchange": {
      const session = params.get("session");
      const id = params.get("id");
      if (!session || !id) return { status: 400, body: { error: "session and id are required" } };
      return { status: 200, body: store.getExchangeMessages(session, id) };
    }
    default:
      return { status: 404, body: { error: "not found" } };
  }
}
