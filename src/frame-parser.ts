export type Frame =
  | { kind: "json"; raw: string; message: unknown }
  | { kind: "malformed"; raw: string };

export class FrameParser {
  private buffer = "";

  push(chunk: string): Frame[] {
    this.buffer += chunk;
    const frames: Frame[] = [];

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const raw = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (raw.trim() === "") continue;
      try {
        frames.push({ kind: "json", raw, message: JSON.parse(raw) });
      } catch {
        frames.push({ kind: "malformed", raw });
      }
    }

    return frames;
  }
}
