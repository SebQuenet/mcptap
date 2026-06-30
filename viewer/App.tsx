import { useCallback, useEffect, useState } from "react";

type Status = "ok" | "error" | "pending";

interface TimelineItem {
  sessionId: string;
  serverLabel: string;
  client: string | null;
  jsonrpcId: string;
  method: string | null;
  toolName: string | null;
  startedAt: number;
  durationMs: number | null;
  status: Status;
  reqTokens: number | null;
  respTokens: number | null;
}

interface CostSummary {
  exchangeCount: number;
  errorCount: number;
  totalTokens: number;
  byTool: { toolName: string; calls: number; tokens: number }[];
  byServer: { serverLabel: string; calls: number; tokens: number }[];
}

interface MessageRow {
  id: number;
  direction: "client_to_server" | "server_to_client";
  kind: string;
  payload: string;
  estTokens: number | null;
  ts: number;
}

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString();
const fmtTokens = (n: number | null) => (n == null ? "—" : String(n));
const fmtDuration = (n: number | null) => (n == null ? "—" : `${n} ms`);

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function App() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | Status>("");
  const [detail, setDetail] = useState<{ item: TimelineItem; messages: MessageRow[] } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const [tl, c] = await Promise.all([
      fetch(`/api/timeline?${params}`).then((r) => r.json()),
      fetch("/api/cost").then((r) => r.json()),
    ]);
    setTimeline(tl);
    setCost(c);
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (item: TimelineItem) => {
    const messages = await fetch(
      `/api/exchange?session=${encodeURIComponent(item.sessionId)}&id=${encodeURIComponent(item.jsonrpcId)}`,
    ).then((r) => r.json());
    setDetail({ item, messages });
  };

  const request = detail?.messages.find((m) => m.direction === "client_to_server");
  const response = detail?.messages.find((m) => m.direction === "server_to_client");

  return (
    <>
      <header>
        <h1>mcptap</h1>
        <span className="tag">local MCP capture · nothing leaves this machine</span>
      </header>

      {cost && (
        <div className="cost-bar">
          <div className="metric">
            <span className="v">{cost.exchangeCount}</span>
            <span className="k">exchanges</span>
          </div>
          <div className="metric">
            <span className="v">{cost.totalTokens.toLocaleString()}</span>
            <span className="k">est. context tokens</span>
          </div>
          <div className="metric">
            <span className="v">{cost.errorCount}</span>
            <span className="k">errors</span>
          </div>
          <div className="metric">
            <span className="v">{cost.byTool[0]?.toolName ?? "—"}</span>
            <span className="k">top tool by tokens</span>
          </div>
          <div className="metric">
            <span className="v">{cost.byServer[0]?.serverLabel ?? "—"}</span>
            <span className="k">top server by tokens</span>
          </div>
        </div>
      )}

      <div className="toolbar">
        <input
          placeholder="filter by method or tool…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | Status)}>
          <option value="">all statuses</option>
          <option value="ok">ok</option>
          <option value="error">error</option>
          <option value="pending">pending</option>
        </select>
        <button onClick={() => void load()}>refresh</button>
      </div>

      {timeline.length === 0 ? (
        <div className="empty">No tool calls captured yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>time</th>
              <th>server</th>
              <th>method / tool</th>
              <th>status</th>
              <th>duration</th>
              <th>tokens (req / resp)</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((t) => (
              <tr key={`${t.sessionId}:${t.jsonrpcId}`} onClick={() => void openDetail(t)}>
                <td className="muted">{fmtTime(t.startedAt)}</td>
                <td>
                  {t.serverLabel}
                  {t.client ? <span className="muted"> · {t.client}</span> : null}
                </td>
                <td>
                  {t.toolName ?? t.method ?? <span className="muted">—</span>}
                  {t.toolName && t.method ? <span className="muted"> ({t.method})</span> : null}
                </td>
                <td>
                  <span className={`status ${t.status}`}>{t.status}</span>
                </td>
                <td className="muted">{fmtDuration(t.durationMs)}</td>
                <td className="muted">
                  {fmtTokens(t.reqTokens)} / {fmtTokens(t.respTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {detail && (
        <div className="drawer">
          <button className="close" onClick={() => setDetail(null)}>
            close
          </button>
          <h2>
            {detail.item.toolName ?? detail.item.method ?? "exchange"}{" "}
            <span className="muted">#{detail.item.jsonrpcId}</span>
          </h2>
          <div className="muted">
            {detail.item.serverLabel} · {fmtDuration(detail.item.durationMs)} ·{" "}
            <span className={`status ${detail.item.status}`}>{detail.item.status}</span>
          </div>

          <h3>request</h3>
          <pre>{request ? prettyJson(request.payload) : "—"}</pre>

          <h3>response</h3>
          <pre>{response ? prettyJson(response.payload) : "(no response captured)"}</pre>
        </div>
      )}
    </>
  );
}
