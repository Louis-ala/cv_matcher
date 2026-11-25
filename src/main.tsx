import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource/playwrite-fr-moderne/400.css";
import "./styles.css";
import { AppProvider } from "./state/AppState";
import Layout from "./Layout";
import Home from "./pages/Home";
import SettingsPage from "./pages/Settings";
import CvPage from "./pages/Cv";
import OffersPage from "./pages/Offers";
import OfferDetail from "./pages/OfferDetail";
import NotFound from "./pages/NotFound";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/reglages", element: <SettingsPage /> },
      { path: "/cv", element: <CvPage /> },
      { path: "/offres", element: <OffersPage /> },
      { path: "/offres/:id", element: <OfferDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  </StrictMode>,
);
