import { Provider } from "__UI_PKG__/provider";
import { Toaster } from "__UI_PKG__/toaster";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "#/App";
import { system } from "#/theme";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <Provider system={system}>
      <App />
      <Toaster />
    </Provider>
  </StrictMode>,
);
