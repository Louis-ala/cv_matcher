import { Link } from "react-router-dom";
import { Row } from "../components/ui";

export default function NotFound() {
  return (
    <div className="page">
      <Row note={<span className="hand hand--red">Hors sujet</span>}>
        <h1>Cette page n'existe pas.</h1>
        <p className="lede">Le lien est peut-être ancien, ou l'offre a été remplacée par une nouvelle recherche.</p>
        <p><Link className="btn btn--primary" to="/">Revenir à l'accueil</Link></p>
      </Row>
    </div>
  );
}
