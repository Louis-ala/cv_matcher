import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDate, Grade, Icon, Row, Status } from "../components/ui";
import { ACTORS } from "../lib/apify";
import type { SourceId } from "../lib/types";
import { useApp } from "../state/AppState";

type Sort = "score" | "date";

export default function OffersPage() {
  const { data, jobs, rescore, aiReady } = useApp();
  const [source, setSource] = useState<SourceId | "all">("all");
  const [min, setMin] = useState(0);
  const [sort, setSort] = useState<Sort>("score");
  const searchJob = jobs.search;
  const unscored = data.offers.filter((o) => !o.match).length;

  const offers = useMemo(() => {
    return data.offers
      .filter((o) => source === "all" || o.source === source)
      .filter((o) => (min === 0 ? true : (o.match?.score ?? 0) / 5 >= min))
      .sort((a, b) =>
        sort === "score"
          ? (b.match?.score ?? -1) - (a.match?.score ?? -1)
          : new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
      );
  }, [data.offers, source, min, sort]);

  if (data.offers.length === 0) {
    return (
      <div className="page offers">
        <Row note={<span className="hand">Offres</span>}>
          <h1>Aucune offre pour l'instant</h1>
          <p className="lede">Déposez votre CV puis lancez une recherche : les offres apparaîtront ici, notées sur 20.</p>
          <Status job={searchJob} />
          <p><Link className="btn btn--primary btn--lg" to="/cv"><Icon name="upload" /> Aller à mon CV</Link></p>
        </Row>
      </div>
    );
  }

  return (
    <div className="page offers">
      <Row note={<><span className="hand">Offres</span><span className="note-small">Recherche {formatDate(data.lastSearchAt)}</span></>}>
        <div className="offers__head">
          <div>
            <h1>{data.offers.length} offres pour « {data.criteria?.query} »</h1>
            <p className="lede">Notées sur 20 : compétences 50 %, expérience 30 %, secteur 20 %. Ouvrez une offre pour son dossier de candidature.</p>
          </div>
          <Link className="btn btn--ghost" to="/cv"><Icon name="search" /> Nouvelle recherche</Link>
        </div>
        <Status job={searchJob} />
        {unscored > 0 && searchJob?.phase !== "running" && (
          <p className="warn">
            <Icon name="alert" /> {unscored} offre{unscored > 1 ? "s" : ""} pas encore notée{unscored > 1 ? "s" : ""}.
            <button type="button" className="btn btn--small" onClick={() => void rescore()} disabled={!aiReady}>Noter maintenant</button>
          </p>
        )}
      </Row>

      <Row note={<span className="note-small">Filtres</span>}>
        <div className="filters" role="group" aria-label="Filtrer les offres">
          <div className="seg" role="radiogroup" aria-label="Source">
            {(["all", "indeed", "wttj"] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={source === s} className={source === s ? "is-on" : ""} onClick={() => setSource(s)}>
                {s === "all" ? "Toutes" : ACTORS[s].label}
              </button>
            ))}
          </div>
          <label className="inline">
            Note min.
            <select value={min} onChange={(e) => setMin(Number(e.target.value))}>
              <option value={0}>toutes</option>
              <option value={10}>10/20</option>
              <option value={12}>12/20</option>
              <option value={15}>15/20</option>
            </select>
          </label>
          <label className="inline">
            Trier par
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="score">note</option>
              <option value="date">date</option>
            </select>
          </label>
        </div>
      </Row>

      <div className="ledger" role="table" aria-label="Offres d'emploi">
        <div className="ledger__row ledger__row--head" role="row">
          <span role="columnheader">Note</span>
          <span role="columnheader">Poste</span>
          <span role="columnheader" className="col-loc">Lieu</span>
          <span role="columnheader" className="col-src">Source</span>
          <span role="columnheader" className="col-date">Publiée</span>
          <span role="columnheader" className="col-state">Dossier</span>
        </div>
        {offers.map((o) => {
          const d = data.dossiers[o.id];
          return (
            <Link key={o.id} to={`/offres/${o.id}`} className="ledger__row" role="row">
              <span role="cell" className="col-grade"><Grade score={o.match?.score} /></span>
              <span role="cell" className="col-title">
                <strong>{o.title}</strong>
                <span>{o.company}{o.salary ? ` · ${o.salary}` : ""}{o.contract ? ` · ${o.contract}` : ""}</span>
                {o.match && <em>{o.match.resume}</em>}
              </span>
              <span role="cell" className="col-loc">{o.location}</span>
              <span role="cell" className="col-src"><span className={`src src--${o.source}`}>{o.source === "wttj" ? "WTTJ" : "Indeed"}</span></span>
              <span role="cell" className="col-date num">{formatDate(o.publishedAt)}</span>
              <span role="cell" className="col-state">
                {d?.applied ? <span className="stamp">Postulé</span> : d?.letter ? <span className="pill">Lettre prête</span> : <Icon name="arrow" />}
              </span>
            </Link>
          );
        })}
        {offers.length === 0 && <p className="ledger__empty">Aucune offre ne correspond à ces filtres.</p>}
      </div>
    </div>
  );
}
