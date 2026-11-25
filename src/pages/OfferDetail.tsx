import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { formatDate, Grade, Icon, Row, Status } from "../components/ui";
import { ACTORS } from "../lib/apify";
import { providerInfo } from "../lib/providers";
import type { Letter, Offer, Profile } from "../lib/types";
import { useApp } from "../state/AppState";

const TABS = [
  { id: "lettre", label: "Lettre de motivation", icon: "pen" as const },
  { id: "entretien", label: "Entretien", icon: "chat" as const },
  { id: "analyse", label: "Analyse", icon: "search" as const },
  { id: "annonce", label: "Annonce", icon: "file" as const },
];

function letterText(letter: Letter, profile: Profile, offer: Offer) {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const city = profile.localisation.split(",")[0] || "";
  return [
    [profile.nom, profile.email, profile.telephone].filter(Boolean).join("\n"),
    "",
    offer.company,
    "",
    `${city ? `${city}, le ` : "Le "}${today}`,
    "",
    `Objet : ${letter.objet}`,
    "",
    letter.salutation,
    "",
    ...letter.paragraphes.flatMap((p) => [p.texte, ""]),
    letter.formule,
    "",
    profile.nom,
  ].join("\n");
}

function LetterSheet({ offer }: { offer: Offer }) {
  const { data, jobs, generateLetter, saveLetter, aiReady, settings } = useApp();
  const letter = data.dossiers[offer.id]?.letter;
  const profile = data.profile!;
  const job = jobs[`letter:${offer.id}`];
  const running = job?.phase === "running";
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [copied, setCopied] = useState(false);

  if (!letter) {
    return (
      <Row note={<span className="hand">Lettre</span>}>
        <div className="empty">
          <h2>La lettre n'est pas encore écrite</h2>
          <p>Elle s'appuie sur votre CV et sur ce que l'annonce dit de {offer.company}. Chaque paragraphe indiquera sa source dans la marge.</p>
          <div className="actions">
            <button type="button" className="btn btn--primary btn--lg" disabled={!aiReady || running} onClick={() => void generateLetter(offer.id)}>
              <Icon name="pen" /> Rédiger la lettre
            </button>
            <span className="cost">1 appel à {providerInfo(settings.provider).name}</span>
          </div>
          <Status job={job} />
        </div>
      </Row>
    );
  }

  const full = letterText(letter, profile, offer);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copie impossible : sélectionnez le texte manuellement.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([full], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lettre de motivation - ${offer.company}.txt`.replace(/[\\/:*?"<>|]/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  };
  const editPara = (i: number, texte: string) =>
    saveLetter(offer.id, { ...letter, paragraphes: letter.paragraphes.map((p, j) => (j === i ? { ...p, texte } : p)) });
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <Row note={<span className="note-small">Rédigée {formatDate(letter.generatedAt)}</span>}>
        <div className="toolbar">
          <button type="button" className="btn btn--primary" onClick={() => void copy()}>
            <Icon name={copied ? "check" : "copy"} /> {copied ? "Copiée" : "Copier la lettre"}
          </button>
          <button type="button" className="btn" onClick={download}><Icon name="download" /> .txt</button>
          <button type="button" className="btn" onClick={() => window.print()}><Icon name="print" /> Imprimer / PDF</button>
          <button type="button" className={`btn ${editing ? "is-on" : ""}`} aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
            <Icon name="pen" /> {editing ? "Terminer" : "Modifier"}
          </button>
        </div>
      </Row>

      <article className="letter" aria-label="Lettre de motivation">
        <Row className="letter__meta">
          <div className="letter__from">
            <strong>{profile.nom}</strong>
            {profile.email && <span>{profile.email}</span>}
            {profile.telephone && <span>{profile.telephone}</span>}
          </div>
          <div className="letter__to">
            <strong>{offer.company}</strong>
            <span>{offer.location}</span>
            <span>Le {today}</span>
          </div>
        </Row>
        <Row><p className="letter__objet"><strong>Objet :</strong> {letter.objet}</p></Row>
        <Row><p>{letter.salutation}</p></Row>
        {letter.paragraphes.map((p, i) => (
          <Row
            key={i}
            className={`letter__para ${active === i ? "is-lit" : ""}`}
            note={
              <button type="button" className="margin-note hand" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)} onBlur={() => setActive(null)} aria-label={`Source du paragraphe ${i + 1} : ${p.source}`}>
                {p.source}
              </button>
            }
          >
            {editing ? (
              <textarea className="para-edit" value={p.texte} rows={Math.max(3, Math.ceil(p.texte.length / 80))}
                onChange={(e) => editPara(i, e.target.value)} aria-label={`Paragraphe ${i + 1}`} />
            ) : (
              <p><mark>{p.texte}</mark></p>
            )}
          </Row>
        ))}
        <Row><p>{letter.formule}</p></Row>
        <Row><p className="letter__sign">{profile.nom}</p></Row>
      </article>

      <Row note={<span className="hand">Retoucher</span>} className="no-print">
        <form className="regen" onSubmit={(e) => { e.preventDefault(); void generateLetter(offer.id, instruction || undefined); }}>
          <label htmlFor="instr">Réécrire avec une consigne</label>
          <div className="regen__line">
            <input id="instr" value={instruction} onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ex. : plus court, insister sur le management, ton plus chaleureux…" />
            <button type="submit" className="btn" disabled={!aiReady || running}><Icon name="refresh" /> Réécrire</button>
          </div>
          <p className="hint">Remplace la lettre actuelle, vos modifications manuelles comprises.</p>
          <Status job={job} />
        </form>
      </Row>
    </>
  );
}

function InterviewPrep({ offer }: { offer: Offer }) {
  const { data, jobs, generateInterview, aiReady, settings } = useApp();
  const interview = data.dossiers[offer.id]?.interview;
  const job = jobs[`interview:${offer.id}`];
  const running = job?.phase === "running";

  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof interview>["questions"]>();
    interview?.questions.forEach((q) => m.set(q.categorie, [...(m.get(q.categorie) ?? []), q]));
    return [...m.entries()];
  }, [interview]);

  if (!interview) {
    return (
      <Row note={<span className="hand">Entretien</span>}>
        <div className="empty">
          <h2>Préparez l'entretien chez {offer.company}</h2>
          <p>Questions probables de parcours, de motivation, techniques et de mise en situation, avec une réponse rédigée à partir de votre CV, y compris pour vos points faibles face à cette offre.</p>
          <div className="actions">
            <button type="button" className="btn btn--primary btn--lg" disabled={!aiReady || running} onClick={() => void generateInterview(offer.id)}>
              <Icon name="chat" /> Préparer les questions
            </button>
            <span className="cost">1 appel à {providerInfo(settings.provider).name}</span>
          </div>
          <Status job={job} />
        </div>
      </Row>
    );
  }

  return (
    <>
      {groups.map(([cat, qs]) => (
        <section key={cat} className="qa-group" aria-label={cat}>
          <Row><h2 className="qa-group__title">{cat}</h2></Row>
          {qs.map((q, i) => (
            <Row key={i} note={<span className="margin-note margin-note--static hand">CV : {q.appui}</span>}>
              <details className="qa" open={i === 0}>
                <summary>
                  <span className="qa__q">{q.question}</span>
                  <span className="qa__why">{q.intention}</span>
                </summary>
                <p className="qa__a">{q.reponse}</p>
              </details>
            </Row>
          ))}
        </section>
      ))}
      <Row note={<span className="note-small">Préparé {formatDate(interview.generatedAt)}</span>}>
        <div className="actions">
          <button type="button" className="btn" disabled={!aiReady || running} onClick={() => void generateInterview(offer.id)}>
            <Icon name="refresh" /> Nouvelles questions
          </button>
        </div>
        <Status job={job} />
      </Row>
    </>
  );
}

function Analysis({ offer }: { offer: Offer }) {
  if (!offer.match) {
    return <Row><p className="lede">Cette offre n'a pas encore été notée. Retournez à la liste et cliquez sur « Noter maintenant ».</p></Row>;
  }
  return (
    <>
      <Row note={<Grade score={offer.match.score} size="lg" />}>
        <p className="verdict">{offer.match.resume}</p>
      </Row>
      <Row note={<span className="hand">Points forts</span>}>
        <ul className="ticks">{offer.match.pointsForts.map((s, i) => <li key={i}><Icon name="check" size={16} /> {s}</li>)}</ul>
      </Row>
      <Row note={<span className="hand hand--red">Lacunes</span>}>
        {offer.match.lacunes.length ? (
          <ul className="gaps">{offer.match.lacunes.map((s, i) => <li key={i}>{s}</li>)}</ul>
        ) : <p>Aucune lacune majeure relevée.</p>}
        <p className="hint">L'onglet Entretien prépare une réponse honnête à ces points.</p>
      </Row>
    </>
  );
}

function Posting({ offer }: { offer: Offer }) {
  return (
    <>
      {offer.companyDescription && (
        <Row note={<span className="hand">L'entreprise</span>}>
          <p className="prose">{offer.companyDescription}</p>
          {offer.companyWebsite && (
            <p><a className="link" href={offer.companyWebsite} target="_blank" rel="noreferrer">{offer.companyWebsite.replace(/^https?:\/\//, "")} <Icon name="external" size={14} /></a></p>
          )}
        </Row>
      )}
      <Row note={<span className="hand">L'annonce</span>}>
        <div className="prose prose--pre">{offer.description || "Description non fournie par la source."}</div>
      </Row>
    </>
  );
}

export default function OfferDetail() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, setApplied } = useApp();
  const offer = data.offers.find((o) => o.id === id);
  const tab = TABS.some((t) => t.id === params.get("onglet")) ? params.get("onglet")! : "lettre";

  if (!offer) {
    return (
      <div className="page">
        <Row note={<span className="hand hand--red">Introuvable</span>}>
          <h1>Cette offre n'est plus dans votre liste</h1>
          <p className="lede">Une nouvelle recherche a peut-être remplacé les résultats précédents.</p>
          <p><Link className="btn btn--primary" to="/offres">Revenir aux offres</Link></p>
        </Row>
      </div>
    );
  }
  if (!data.profile || !data.cvText) {
    return (
      <div className="page">
        <Row note={<span className="hand hand--red">CV manquant</span>}>
          <h1>Ajoutez d'abord votre CV</h1>
          <p className="lede">La lettre et les réponses d'entretien sont rédigées à partir de votre CV.</p>
          <p><Link className="btn btn--primary" to="/cv">Aller à mon CV</Link></p>
        </Row>
      </div>
    );
  }

  const applied = Boolean(data.dossiers[offer.id]?.applied);

  return (
    <div className="page dossier">
      <Row className="no-print" note={<Link to="/offres" className="back"><Icon name="arrow" size={14} /> Offres</Link>}>
        <header className="dossier__head">
          <div className="dossier__id">
            <p className="dossier__co">{offer.company}</p>
            <h1>{offer.title}</h1>
            <p className="dossier__facts">
              <span>{offer.location}</span>
              {offer.contract && <span>{offer.contract}</span>}
              {offer.remote && <span>{offer.remote}</span>}
              {offer.salary && <span className="num">{offer.salary}</span>}
              <span>{ACTORS[offer.source].label} · {formatDate(offer.publishedAt)}</span>
            </p>
          </div>
          <Grade score={offer.match?.score} size="lg" />
        </header>
        <div className="apply">
          <a className="btn btn--primary btn--lg" href={offer.applyUrl} target="_blank" rel="noreferrer">
            Postuler sur le site de l'offre <Icon name="external" />
          </a>
          {offer.applyUrl !== offer.url && (
            <a className="link" href={offer.url} target="_blank" rel="noreferrer">Voir l'annonce sur {ACTORS[offer.source].label} <Icon name="external" size={14} /></a>
          )}
          <label className="toggle">
            <input type="checkbox" checked={applied} onChange={(e) => setApplied(offer.id, e.target.checked)} />
            <span>J'ai postulé</span>
          </label>
          {applied && <span className="stamp">Postulé</span>}
        </div>
      </Row>

      <Row className="no-print">
        <div className="tabs" role="tablist" aria-label="Dossier de candidature">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
              className={tab === t.id ? "is-on" : ""} onClick={() => setParams({ onglet: t.id }, { replace: true })}>
              <Icon name={t.icon} size={16} /> {t.label}
            </button>
          ))}
        </div>
      </Row>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "lettre" && <LetterSheet offer={offer} />}
        {tab === "entretien" && <InterviewPrep offer={offer} />}
        {tab === "analyse" && <Analysis offer={offer} />}
        {tab === "annonce" && <Posting offer={offer} />}
      </div>
    </div>
  );
}
