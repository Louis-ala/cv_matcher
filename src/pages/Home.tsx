import { Link } from "react-router-dom";
import { Grade, Icon, Row } from "../components/ui";
import { useApp } from "../state/AppState";

export default function Home() {
  const { aiReady, apifyReady, data } = useApp();
  const scored = data.offers.filter((o) => o.match);
  const best = [...scored].sort((a, b) => (b.match!.score - a.match!.score)).slice(0, 3);
  const letters = Object.values(data.dossiers).filter((d) => d.letter).length;

  const steps = [
    { label: "Clés", done: aiReady && apifyReady, to: "/reglages" },
    { label: "CV", done: Boolean(data.profile), to: "/cv" },
    { label: "Offres", done: scored.length > 0, to: "/offres" },
    { label: "Dossiers", done: letters > 0, to: "/offres" },
  ];
  const next = steps.find((s) => !s.done);

  const cta = !aiReady || !apifyReady
    ? { to: "/reglages", label: "Ajouter mes clés", icon: "key" as const }
    : !data.profile
      ? { to: "/cv", label: "Déposer mon CV", icon: "upload" as const }
      : { to: "/offres", label: scored.length ? "Voir mes offres" : "Chercher des offres", icon: "arrow" as const };

  return (
    <div className="page home">
      <Row
        className="home__hero"
        note={
          <ol className="progress" aria-label="Avancement">
            {steps.map((s, i) => (
              <li key={s.label} className={s.done ? "is-done" : s === next ? "is-next" : ""}>
                <Link to={s.to}>
                  <span className="progress__n">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="hand">{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        }
      >
        <div className="hero">
          <div className="hero__text">
            <h1>Votre CV. De vraies offres. Une candidature prête pour chacune.</h1>
            <p className="lede">
              Déposez votre CV en PDF : l'app cherche sur Indeed et Welcome to the Jungle, note chaque offre sur 20,
              puis rédige la lettre de motivation adaptée à l'entreprise et prépare vos réponses d'entretien. Chaque
              phrase indique en marge d'où elle vient de votre CV.
            </p>
            <p className="hero__actions">
              <Link className="btn btn--primary btn--lg" to={cta.to}>
                <Icon name={cta.icon} /> {cta.label}
              </Link>
              {data.profile && (
                <Link className="btn btn--ghost" to="/cv">Modifier ma recherche</Link>
              )}
            </p>
          </div>

          {best.length > 0 ? (
            <section className="excerpt" aria-labelledby="best-title">
              <h2 id="best-title" className="excerpt__title">Vos meilleures offres</h2>
              <ul className="excerpt__list">
                {best.map((o) => (
                  <li key={o.id}>
                    <Link to={`/offres/${o.id}`}>
                      <Grade score={o.match!.score} size="sm" />
                      <span>
                        <strong>{o.company}</strong>
                        <span>{o.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <figure className="excerpt excerpt--sample" aria-label="Exemple de dossier, données fictives">
              <span className="excerpt__tag">Exemple fictif</span>
              <div className="excerpt__head">
                <div>
                  <strong>Atelier Nova</strong>
                  <span>Développeur·se front-end React · Lyon</span>
                </div>
                <Grade score={82} size="lg" />
              </div>
              <div className="excerpt__para">
                <span className="excerpt__note hand">CV : refonte du tunnel de paiement</span>
                <p>Chez Panier Frais, j'ai refondu le tunnel de paiement en React et réduit son abandon de 18 %, un chantier proche de celui que vous ouvrez sur votre application de réservation.</p>
              </div>
              <div className="excerpt__para">
                <span className="excerpt__note hand">Offre : équipe de 6, design system</span>
                <p>Rejoindre une équipe de six personnes qui construit son design system me permettrait d'apporter ma pratique de Storybook…</p>
              </div>
            </figure>
          )}
        </div>
      </Row>

      <Row note={<span className="hand">Comment ça marche</span>} className="home__how">
        <ol className="how">
          <li>
            <h3>Vos clés, chez vous</h3>
            <p>Une clé d'IA (Claude, GPT, Gemini ou Mistral) et un token Apify. Rien ne part ailleurs que chez ces deux fournisseurs.</p>
          </li>
          <li>
            <h3>Le CV devient un profil</h3>
            <p>Le PDF est lu dans votre navigateur ; l'IA en tire vos compétences et les intitulés de poste à chercher.</p>
          </li>
          <li>
            <h3>Offres notées sur 20</h3>
            <p>Apify récupère les annonces récentes ; chacune reçoit une note, ses points forts et vos lacunes réelles.</p>
          </li>
          <li>
            <h3>Un dossier par offre</h3>
            <p>Lettre adaptée à l'entreprise, lien direct pour postuler, questions d'entretien et réponses préparées.</p>
          </li>
        </ol>
      </Row>
    </div>
  );
}
