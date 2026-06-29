// Minimal fake MCP-style stdio server used in wrapper integration tests.
// Reads newline-delimited JSON-RPC requests, echoes the method back as a result.
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    if (line.trim() === "") continue;
    const message = JSON.parse(line);
    const response = JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: { echoed: message.method },
    });
    process.stdout.write(response + "\n");
  }
});

process.stdin.on("end", () => process.exit(0));
