export type ParsedArgs =
  | { cmd: "wrap"; label: string; command: string; args: string[] }
  | { cmd: "init"; dryRun: boolean; revert: boolean }
  | { cmd: "view"; port: number }
  | { cmd: "purge" }
  | { cmd: "help" };

const DEFAULT_VIEW_PORT = 7331;

function parseWrap(rest: string[]): ParsedArgs {
  const sep = rest.indexOf("--");
  if (sep === -1 || sep === rest.length - 1) return { cmd: "help" };

  const flags = rest.slice(0, sep);
  const labelIndex = flags.indexOf("--label");
  const label = labelIndex !== -1 ? flags[labelIndex + 1] : undefined;

  const command = rest[sep + 1];
  const args = rest.slice(sep + 2);

  return { cmd: "wrap", label: label ?? command, command, args };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [cmd, ...rest] = argv;

  switch (cmd) {
    case "wrap":
      return parseWrap(rest);
    case "init":
      return { cmd: "init", dryRun: rest.includes("--dry-run"), revert: rest.includes("--revert") };
    case "view": {
      const portIndex = rest.indexOf("--port");
      const port = portIndex !== -1 ? Number(rest[portIndex + 1]) : DEFAULT_VIEW_PORT;
      return { cmd: "view", port };
    }
    case "purge":
      return { cmd: "purge" };
    default:
      return { cmd: "help" };
  }
}
