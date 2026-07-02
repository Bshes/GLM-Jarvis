/**
 * ZAI SDK singleton + typed helpers.
 * The z-ai-web-dev-sdk MUST be used server-side only.
 */
import ZAI from "z-ai-web-dev-sdk";

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let _bootPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null;

export async function getZAI() {
  if (_zai) return _zai;
  if (!_bootPromise) {
    _bootPromise = ZAI.create();
  }
  _zai = await _bootPromise;
  return _zai;
}

export interface ChatOptions {
  system?: string;
  thinking?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/** Simple non-streaming chat completion returning the assistant text. */
export async function chat(prompt: string, opts: ChatOptions = {}): Promise<string> {
  const zai = await getZAI();
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: opts.thinking ? "enabled" : "disabled" },
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  } as Parameters<typeof zai.chat.completions.create>[0]);

  return completion?.choices?.[0]?.message?.content ?? "";
}

/** JSON-mode chat: asks the model for strict JSON and parses it defensively. */
export async function chatJSON<T = unknown>(prompt: string, opts: ChatOptions = {}): Promise<T> {
  const raw = await chat(prompt, opts);
  return extractJSON<T>(raw);
}

export function extractJSON<T = unknown>(text: string): T {
  // Strip code fences and prose, then locate the outermost JSON object/array.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.search(/[{[]/);
  if (start === -1) throw new Error("No JSON found in model response");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        return JSON.parse(slice) as T;
      }
    }
  }
  throw new Error("Unterminated JSON in model response");
}

export interface WebSearchHit {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
}

export async function webSearch(query: string, num = 5): Promise<WebSearchHit[]> {
  const zai = await getZAI();
  try {
    const results = await zai.functions.invoke("web_search", { query, num });
    return (results ?? []) as WebSearchHit[];
  } catch {
    return [];
  }
}

export async function textToSpeechBase64(input: string, voice = "tongtong"): Promise<string> {
  const zai = await getZAI();
  const response = await zai.audio.tts.create({
    input,
    voice,
    response_format: "wav",
    stream: false,
  } as Parameters<typeof zai.audio.tts.create>[0]);
  const ab = await response.arrayBuffer();
  const buf = Buffer.from(new Uint8Array(ab));
  return `data:audio/wav;base64,${buf.toString("base64")}`;
}

export async function speechToText(fileBase64: string): Promise<string> {
  const zai = await getZAI();
  const response = await zai.audio.asr.create({ file_base64: fileBase64 } as Parameters<
    typeof zai.audio.asr.create
  >[0]);
  return (response as { text?: string })?.text ?? "";
}
