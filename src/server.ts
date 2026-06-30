import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { handleApiRequest } from "./api.js";
import type { Store } from "./store.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function resolveStaticFile(staticDir: string, pathname: string): string | null {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const candidate = resolve(staticDir, `.${normalize(requested)}`);
  // Path-traversal guard: never serve outside the static root.
  if (candidate !== staticDir && !candidate.startsWith(staticDir + sep)) return null;
  if (existsSync(candidate)) return candidate;
  // SPA fallback for client-side routes.
  const indexPath = join(staticDir, "index.html");
  return existsSync(indexPath) ? indexPath : null;
}

export function createViewerServer(store: Store, staticDir?: string): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname.startsWith("/api/")) {
      const { status, body } = handleApiRequest(store, url.pathname, url.searchParams);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }

    if (staticDir) {
      const filePath = resolveStaticFile(staticDir, url.pathname);
      if (filePath) {
        res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
        res.end(readFileSync(filePath));
        return;
      }
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  });
}

/** Start the viewer bound to 127.0.0.1 only (privacy invariant: never externally reachable). */
export function startViewer(store: Store, port: number, staticDir?: string): Promise<Server> {
  const server = createViewerServer(store, staticDir);
  return new Promise((resolveListen) => {
    server.listen(port, "127.0.0.1", () => resolveListen(server));
  });
}
