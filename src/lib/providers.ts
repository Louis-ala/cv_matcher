import Anthropic from "@anthropic-ai/sdk";
import type { ProviderId, Settings } from "./types";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  company: string;
  keyHint: string;
  keyUrl: string;
  suggestedModels: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    name: "Claude",
    company: "Anthropic",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    suggestedModels: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  },
  {
    id: "openai",
    name: "GPT",
    company: "OpenAI",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    suggestedModels: ["gpt-5", "gpt-5-mini"],
  },
  {
    id: "gemini",
    name: "Gemini",
    company: "Google",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    suggestedModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "mistral",
    name: "Mistral",
    company: "Mistral AI",
    keyHint: "clé Mistral",
    keyUrl: "https://console.mistral.ai/api-keys",
    suggestedModels: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
  },
];

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!;

export class AIError extends Error {}

const base = (p: string) => `${window.location.origin}/api/${p}`;

export interface JsonRequest {
  system: string;
  user: string;
  /** JSON Schema strict (additionalProperties: false partout) décrivant la réponse. */
  schema: Record<string, unknown>;
  schemaName: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

function anthropicClient(key: string) {
  return new Anthropic({ apiKey: key, baseURL: base("anthropic"), dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Extrait un objet JSON d'un texte (tolère les blocs ```json). */
export function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* tombe dans l'erreur ci-dessous */
      }
    }
    throw new AIError("La réponse du modèle n'était pas un JSON valide. Réessayez, ou choisissez un autre modèle.");
  }
}

async function httpJson(url: string, init: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new AIError("Le fournisseur est injoignable. Vérifiez votre connexion et que l'app tourne via « npm run dev ».");
  }
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? body?.detail ?? text.slice(0, 200);
    if (res.status === 401 || res.status === 403) throw new AIError(`Clé refusée par le fournisseur (${res.status}). ${msg}`);
    if (res.status === 404) throw new AIError(`Modèle ou ressource introuvable (404). ${msg}`);
    if (res.status === 429) throw new AIError(`Limite de requêtes atteinte (429). Patientez un peu. ${msg}`);
    throw new AIError(`Erreur ${res.status} du fournisseur. ${msg}`);
  }
  return body;
}

function schemaHint(req: JsonRequest) {
  return `\n\nRéponds UNIQUEMENT avec un objet JSON valide (sans texte autour) conforme à ce schéma JSON :\n${JSON.stringify(req.schema)}`;
}

function translateAnthropicError(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError) throw new AIError("Clé Anthropic refusée (401). Vérifiez-la dans Réglages.");
  if (e instanceof Anthropic.PermissionDeniedError) throw new AIError("Cette clé Anthropic n'a pas accès à ce modèle (403).");
  if (e instanceof Anthropic.NotFoundError) throw new AIError("Modèle Anthropic introuvable (404). Choisissez-en un autre dans Réglages.");
  if (e instanceof Anthropic.RateLimitError) throw new AIError("Limite de requêtes Anthropic atteinte (429). Patientez un peu.");
  if (e instanceof Anthropic.BadRequestError) throw new AIError(`Requête refusée par Anthropic (400) : ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) throw new AIError("Anthropic est injoignable. L'app doit tourner via « npm run dev ».");
  if (e instanceof Anthropic.APIError) throw new AIError(`Erreur Anthropic ${e.status ?? ""} : ${e.message}`);
  throw e;
}

async function anthropicJson(settings: Settings, req: JsonRequest): Promise<string> {
  const client = anthropicClient(settings.apiKeys.anthropic);
  const model = settings.models.anthropic;
  const supportsFallback = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      output_config: {
        effort: req.effort ?? "medium",
        format: { type: "json_schema", schema: req.schema },
      },
      ...(supportsFallback
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") {
      throw new AIError("Le modèle a refusé de répondre à cette demande. Reformulez ou essayez un autre modèle.");
    }
    if (msg.stop_reason === "max_tokens") {
      throw new AIError("La réponse a été coupée (limite de longueur). Réessayez.");
    }
    return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } catch (e) {
    if (e instanceof AIError) throw e;
    translateAnthropicError(e);
  }
}

async function openaiLikeJson(settings: Settings, req: JsonRequest, provider: "openai" | "mistral"): Promise<string> {
  const body = await httpJson(`${base(provider)}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKeys[provider]}` },
    body: JSON.stringify({
      model: settings.models[provider],
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user + schemaHint(req) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new AIError("Réponse vide du modèle.");
  return content;
}

async function geminiJson(settings: Settings, req: JsonRequest): Promise<string> {
  const model = settings.models.gemini.replace(/^models\//, "");
  const body = await httpJson(`${base("gemini")}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": settings.apiKeys.gemini },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user + schemaHint(req) }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  const parts: { text?: string }[] = body?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  if (!text) {
    const reason = body?.candidates?.[0]?.finishReason ?? body?.promptFeedback?.blockReason;
    throw new AIError(`Réponse vide de Gemini${reason ? ` (${reason})` : ""}.`);
  }
  return text;
}

/** Envoie une demande au fournisseur choisi et renvoie l'objet JSON décodé. */
export async function completeJson<T>(settings: Settings, req: JsonRequest): Promise<T> {
  const provider = settings.provider;
  if (!settings.apiKeys[provider]) {
    throw new AIError(`Aucune clé ${providerInfo(provider).company} enregistrée. Ajoutez-la dans Réglages.`);
  }
  let raw: string;
  switch (provider) {
    case "anthropic":
      raw = await anthropicJson(settings, req);
      break;
    case "openai":
    case "mistral":
      raw = await openaiLikeJson(settings, req, provider);
      break;
    case "gemini":
      raw = await geminiJson(settings, req);
      break;
  }
  return parseJson<T>(raw);
}

/** Liste les modèles accessibles avec la clé : sert aussi de test de la clé. */
export async function listModels(provider: ProviderId, key: string): Promise<string[]> {
  if (!key) throw new AIError("Saisissez d'abord une clé.");
  switch (provider) {
    case "anthropic": {
      try {
        const ids: string[] = [];
        for await (const m of anthropicClient(key).models.list({ limit: 100 })) ids.push(m.id);
        return ids;
      } catch (e) {
        translateAnthropicError(e);
      }
    }
    case "openai": {
      const body = await httpJson(`${base("openai")}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
      return (body.data as { id: string }[])
        .map((m) => m.id)
        .filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding)/.test(id))
        .sort()
        .reverse();
    }
    case "gemini": {
      const body = await httpJson(`${base("gemini")}/v1beta/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
      return (body.models as { name: string; supportedGenerationMethods?: string[] }[])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(m.name))
        .map((m) => m.name.replace(/^models\//, ""));
    }
    case "mistral": {
      const body = await httpJson(`${base("mistral")}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
      return Array.from(new Set((body.data as { id: string }[]).map((m) => m.id))).filter((id) => !/embed|ocr|moderation/.test(id));
    }
  }
}
