import { getEncoding, type Tiktoken, type TiktokenEncoding } from "js-tiktoken";

export const DEFAULT_ENCODING: TiktokenEncoding = "o200k_base";

const encoderCache = new Map<TiktokenEncoding, Tiktoken>();

function encoderFor(encoding: TiktokenEncoding): Tiktoken {
  let enc = encoderCache.get(encoding);
  if (!enc) {
    enc = getEncoding(encoding);
    encoderCache.set(encoding, enc);
  }
  return enc;
}

/**
 * Estimate the number of context tokens a piece of text represents.
 *
 * This is an estimate of context cost (what gets injected into the model's
 * context window), not the provider's billed token count.
 */
export function estimateTokens(text: string, encoding: TiktokenEncoding = DEFAULT_ENCODING): number {
  if (text === "") return 0;
  return encoderFor(encoding).encode(text).length;
}
