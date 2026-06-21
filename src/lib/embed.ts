/**
 * memory/embed.ts — deterministic lightweight text embedding.
 *
 * Stand-in for ChromaDB: a hashed bag-of-words vector with cosine similarity.
 * Fully offline, deterministic, and good enough to demonstrate semantic recall
 * over the episodic store without an external embedding service.
 */

export const EMBED_DIM = 128;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "is", "are", "was",
  "were", "be", "been", "to", "of", "in", "on", "at", "for", "with", "by",
  "this", "that", "it", "as", "my", "your", "i", "you", "we", "they", "he",
  "she", "do", "does", "did", "so", "than", "too", "very", "can", "will",
  "just", "should", "now", "me", "him", "her", "us", "them",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = tokenize(text);
  for (const t of tokens) {
    const idx = hash(t) % EMBED_DIM;
    const sign = hash(t + "salt") % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  // include bigrams for a little structural signal
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = tokens[i] + "_" + tokens[i + 1];
    const idx = hash(bg) % EMBED_DIM;
    vec[idx] += 0.6;
  }
  return normalize(vec);
}

export function normalize(vec: number[]): number[] {
  let mag = 0;
  for (const v of vec) mag += v * v;
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  return vec.map((v) => v / mag);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are pre-normalized
}

export function serialize(vec: number[]): string {
  return JSON.stringify(vec);
}

export function deserialize(s: string | null | undefined): number[] | null {
  if (!s) return null;
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}
