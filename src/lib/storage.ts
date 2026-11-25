import type { AppData, Settings } from "./types";

const SETTINGS_KEY = "cvm.settings";
const DATA_KEY = "cvm.data";

export const defaultSettings: Settings = {
  provider: "anthropic",
  models: {
    anthropic: "claude-opus-5-5",
    openai: "gpt-5",
    gemini: "gemini-2.5-pro",
    mistral: "mistral-large-latest",
  },
  apiKeys: { anthropic: "", openai: "", gemini: "", mistral: "" },
  apifyToken: "",
  remember: true,
  apifyMaxUsd: 0.5,
};

export const emptyData: AppData = { offers: [], dossiers: {} };

function read<T>(store: Storage | undefined, key: string): T | undefined {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(store: Storage | undefined, key: string, value: unknown) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou bloqué : l'app continue en mémoire */
  }
}

function remove(store: Storage | undefined, key: string) {
  try {
    store?.removeItem(key);
  } catch {
    /* ignore */
  }
}

const local = typeof window !== "undefined" ? window.localStorage : undefined;
const session = typeof window !== "undefined" ? window.sessionStorage : undefined;

export function loadSettings(): Settings {
  const saved = read<Partial<Settings>>(local, SETTINGS_KEY) ?? read<Partial<Settings>>(session, SETTINGS_KEY);
  if (!saved) return defaultSettings;
  return {
    ...defaultSettings,
    ...saved,
    models: { ...defaultSettings.models, ...saved.models },
    apiKeys: { ...defaultSettings.apiKeys, ...saved.apiKeys },
  };
}

export function saveSettings(settings: Settings) {
  if (settings.remember) {
    write(local, SETTINGS_KEY, settings);
    remove(session, SETTINGS_KEY);
  } else {
    write(session, SETTINGS_KEY, settings);
    remove(local, SETTINGS_KEY);
  }
}

export function clearSettings() {
  remove(local, SETTINGS_KEY);
  remove(session, SETTINGS_KEY);
}

export function loadData(): AppData {
  const saved = read<AppData>(local, DATA_KEY);
  return saved ? { ...emptyData, ...saved } : emptyData;
}

export function saveData(data: AppData) {
  write(local, DATA_KEY, data);
}

export function clearData() {
  remove(local, DATA_KEY);
}
