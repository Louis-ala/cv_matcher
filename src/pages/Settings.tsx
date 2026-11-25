import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, Row } from "../components/ui";
import { ACTORS, checkApifyToken } from "../lib/apify";
import { listModels, PROVIDERS, providerInfo } from "../lib/providers";
import { clearSettings } from "../lib/storage";
import type { ProviderId } from "../lib/types";
import { useApp } from "../state/AppState";

type Check = { state: "idle" | "busy" | "ok" | "error"; message?: string };

function SecretInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="secret">
        <input id={id} type={shown ? "text" : "password"} value={value} placeholder={placeholder}
          autoComplete="off" spellCheck={false} onChange={(e) => onChange(e.target.value.trim())} />
        <button type="button" className="btn btn--icon" onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Masquer la clé" : "Afficher la clé"}>
          <Icon name={shown ? "eye-off" : "eye"} />
        </button>
      </div>
    </div>
  );
}

function CheckLine({ check }: { check: Check }) {
  if (check.state === "idle") return null;
  return (
    <p className={`check check--${check.state}`} role="status">
      {check.state === "busy" && <span className="spinner" aria-hidden="true" />}
      {check.state === "ok" && <Icon name="check" size={16} />}
      {check.state === "error" && <Icon name="alert" size={16} />}
      {check.message}
    </p>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, aiReady, apifyReady, resetData } = useApp();
  const [aiCheck, setAiCheck] = useState<Check>({ state: "idle" });
  const [apifyCheck, setApifyCheck] = useState<Check>({ state: "idle" });
  const [models, setModels] = useState<Partial<Record<ProviderId, string[]>>>({});
  const provider = providerInfo(settings.provider);
  const modelListId = useId();

  const setKey = (v: string) => {
    updateSettings({ apiKeys: { ...settings.apiKeys, [settings.provider]: v } });
    setAiCheck({ state: "idle" });
  };
  const setModel = (v: string) => updateSettings({ models: { ...settings.models, [settings.provider]: v } });

  async function testAi() {
    setAiCheck({ state: "busy", message: `Connexion à ${provider.company}…` });
    try {
      const ids = await listModels(settings.provider, settings.apiKeys[settings.provider]);
      setModels((m) => ({ ...m, [settings.provider]: ids }));
      const current = settings.models[settings.provider];
      const known = ids.includes(current);
      setAiCheck({
        state: known || ids.length === 0 ? "ok" : "error",
        message: known || ids.length === 0
          ? `Clé valide. ${ids.length} modèles disponibles.`
          : `Clé valide, mais « ${current} » n'est pas dans la liste de votre compte. Choisissez un modèle proposé.`,
      });
    } catch (e) {
      setAiCheck({ state: "error", message: (e as Error).message });
    }
  }

  async function testApify() {
    setApifyCheck({ state: "busy", message: "Connexion à Apify…" });
    try {
      const user = await checkApifyToken(settings.apifyToken);
      setApifyCheck({ state: "ok", message: `Token valide — connecté en tant que ${user}.` });
    } catch (e) {
      setApifyCheck({ state: "error", message: (e as Error).message });
    }
  }

  const options = models[settings.provider] ?? provider.suggestedModels;

  return (
    <div className="page settings">
      <Row note={<span className="hand">Réglages</span>}>
        <h1>Vos clés</h1>
        <p className="lede">
          L'app ne possède aucune clé : c'est vous qui payez directement l'IA et Apify, au prix du fournisseur.
          Les clés sont gardées dans ce navigateur et envoyées uniquement au fournisseur concerné.
        </p>
      </Row>

      <Row
        note={
          <>
            <span className={`hand ${aiReady ? "" : "hand--red"}`}>{aiReady ? "Prêt" : "À faire"}</span>
            <span className="note-small">Lit le CV, note les offres, écrit lettres et réponses.</span>
          </>
        }
      >
        <section className="block" aria-labelledby="ai-title">
          <h2 id="ai-title">Intelligence artificielle</h2>
          <fieldset className="providers">
            <legend>Fournisseur</legend>
            {PROVIDERS.map((p) => (
              <label key={p.id} className={`provider ${settings.provider === p.id ? "is-on" : ""}`}>
                <input type="radio" name="provider" value={p.id} checked={settings.provider === p.id}
                  onChange={() => { updateSettings({ provider: p.id }); setAiCheck({ state: "idle" }); }} />
                <span className="provider__name">{p.name}</span>
                <span className="provider__co">{p.company}</span>
                {settings.apiKeys[p.id] && <span className="provider__key"><Icon name="key" size={14} /> clé</span>}
              </label>
            ))}
          </fieldset>

          <div className="grid-2">
            <SecretInput label={`Clé API ${provider.company}`} value={settings.apiKeys[settings.provider]}
              onChange={setKey} placeholder={provider.keyHint} />
            <div className="field">
              <label htmlFor={modelListId + "-in"}>Modèle</label>
              <input id={modelListId + "-in"} list={modelListId} value={settings.models[settings.provider]}
                onChange={(e) => setModel(e.target.value.trim())} spellCheck={false} />
              <datalist id={modelListId}>
                {options.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={testAi} disabled={!settings.apiKeys[settings.provider] || aiCheck.state === "busy"}>
              <Icon name="check" /> Tester la clé et lister les modèles
            </button>
            <a className="link" href={provider.keyUrl} target="_blank" rel="noreferrer">
              Obtenir une clé {provider.company} <Icon name="external" size={14} />
            </a>
          </div>
          <CheckLine check={aiCheck} />
          {settings.provider === "anthropic" && (
            <p className="hint">Par défaut : Claude Opus 5.5. En cas de refus de sécurité, la requête bascule automatiquement sur un modèle de repli (option « fallbacks » d'Anthropic).</p>
          )}
        </section>
      </Row>

      <Row
        note={
          <>
            <span className={`hand ${apifyReady ? "" : "hand--red"}`}>{apifyReady ? "Prêt" : "À faire"}</span>
            <span className="note-small">Va chercher les offres sur Indeed, Welcome to the Jungle et LinkedIn.</span>
          </>
        }
      >
        <section className="block" aria-labelledby="apify-title">
          <h2 id="apify-title">Apify</h2>
          <div className="grid-2">
            <SecretInput label="Token API Apify" value={settings.apifyToken}
              onChange={(v) => { updateSettings({ apifyToken: v }); setApifyCheck({ state: "idle" }); }} placeholder="apify_api_…" />
            <div className="field">
              <label htmlFor="maxusd">Dépense max. par source et par recherche</label>
              <div className="suffix">
                <input id="maxusd" type="number" min={0.05} max={10} step={0.05} value={settings.apifyMaxUsd}
                  onChange={(e) => updateSettings({ apifyMaxUsd: Math.max(0.05, Number(e.target.value) || 0.5) })} />
                <span>$</span>
              </div>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={testApify} disabled={!settings.apifyToken || apifyCheck.state === "busy"}>
              <Icon name="check" /> Tester le token
            </button>
            <a className="link" href="https://console.apify.com/settings/integrations" target="_blank" rel="noreferrer">
              Trouver mon token <Icon name="external" size={14} />
            </a>
          </div>
          <CheckLine check={apifyCheck} />
          <p className="hint">
            Actors utilisés : <a className="link" href={ACTORS.indeed.store} target="_blank" rel="noreferrer">{ACTORS.indeed.actor}</a>,{" "}
            <a className="link" href={ACTORS.wttj.store} target="_blank" rel="noreferrer">{ACTORS.wttj.actor}</a> et{" "}
            <a className="link" href={ACTORS.linkedin.store} target="_blank" rel="noreferrer">{ACTORS.linkedin.actor}</a>. Une recherche de 15 offres coûte en général moins de 0,10 $.
          </p>
        </section>
      </Row>

      <Row note={<span className="hand">Confidentialité</span>}>
        <section className="block" aria-labelledby="privacy-title">
          <h2 id="privacy-title">Mémorisation</h2>
          <label className="toggle">
            <input type="checkbox" checked={settings.remember} onChange={(e) => updateSettings({ remember: e.target.checked })} />
            <span>Se souvenir des clés sur cet ordinateur</span>
          </label>
          <p className="hint">Décoché : les clés sont effacées à la fermeture de l'onglet.</p>
          <div className="actions">
            <button type="button" className="btn btn--danger" onClick={() => {
              if (!confirm("Effacer toutes les clés enregistrées ?")) return;
              clearSettings();
              updateSettings({ apiKeys: { anthropic: "", openai: "", gemini: "", mistral: "" }, apifyToken: "" });
            }}>
              <Icon name="trash" /> Effacer les clés
            </button>
            <button type="button" className="btn btn--danger" onClick={() => {
              if (confirm("Effacer le CV, les offres, les lettres et les préparations d'entretien ?")) resetData();
            }}>
              <Icon name="trash" /> Effacer CV et dossiers
            </button>
          </div>
        </section>
      </Row>

      {aiReady && apifyReady && (
        <Row>
          <Link className="btn btn--primary btn--lg" to="/cv">Continuer avec mon CV <Icon name="arrow" /></Link>
        </Row>
      )}
    </div>
  );
}
