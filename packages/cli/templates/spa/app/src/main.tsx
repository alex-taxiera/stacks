import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// stacks:slot imports

import { createAppRouter } from "./router";

const router = createAppRouter();
// stacks:slot router

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

// The prerendered HTML is replaced on the first render rather than hydrated: it is there for the
// first paint and for crawlers. Switch to `hydrateRoot` once every page renders the same in Node
// and in the browser.
createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
