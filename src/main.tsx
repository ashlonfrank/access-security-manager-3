import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/500.css";
import "@fontsource/open-sans/600.css";
import App from "./App";
import ProposalOneApp from "./proposals/proposal-one/ProposalOneApp";
import ProposalThreeApp from "./proposals/proposal-three/ProposalThreeApp";
import "./styles.css";
import "./refinements.css";

function resolvePrototype(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("prototype");
  if (fromQuery) return fromQuery;

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  if (hash.startsWith("prototype=")) return hash.slice("prototype=".length);
  return hash;
}

const prototype = resolvePrototype();
// This branch is the proposal-3 preview. The split view is the default so a
// bare server URL still opens it when another agent already owns port 4321.
const Root =
  prototype === "proposal-one"
    ? ProposalOneApp
    : prototype === "baseline" || prototype === "app"
      ? App
      : ProposalThreeApp;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
