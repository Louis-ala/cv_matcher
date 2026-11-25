import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { providerInfo } from "./lib/providers";
import { useApp } from "./state/AppState";

const links = [
  { to: "/", label: "Accueil", end: true },
  { to: "/reglages", label: "Réglages" },
  { to: "/cv", label: "Mon CV" },
  { to: "/offres", label: "Offres" },
];

export default function Layout() {
  const { settings, aiReady, apifyReady, data } = useApp();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <a className="skip" href="#contenu">Aller au contenu</a>
      <header className="masthead">
        <NavLink to="/" className="brand" aria-label="CV Matcher, accueil">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <path d="M0 8h32M0 16h32M0 24h32" stroke="var(--rule-strong)" strokeWidth="1" />
            <path d="M9 0v32" stroke="var(--margin)" strokeWidth="2" />
            <path d="M14 21.5l4.5-11 4.5 11M15.8 17.5h5.4" fill="none" stroke="var(--pen)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>CV Matcher</span>
        </NavLink>
        <nav aria-label="Navigation principale">
          <ul>
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end}>
                  {l.label}
                  {l.to === "/offres" && data.offers.length > 0 && <span className="count">{data.offers.length}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <NavLink to="/reglages" className="keys" title="Clés utilisées">
          <span className={`dot ${aiReady ? "dot--ok" : ""}`} aria-hidden="true" />
          {providerInfo(settings.provider).name}
          <span className={`dot ${apifyReady ? "dot--ok" : ""}`} aria-hidden="true" />
          Apify
          <span className="sr-only">{aiReady && apifyReady ? " : clés configurées" : " : clés à configurer"}</span>
        </NavLink>
      </header>
      <main id="contenu" className="sheet">
        <Outlet />
      </main>
      <footer className="colophon">
        <p>Vos clés et votre CV restent dans ce navigateur. Ils ne sont envoyés qu'au fournisseur d'IA choisi et à Apify, via le proxy local.</p>
      </footer>
    </div>
  );
}
