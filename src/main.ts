import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";

import { createAppStore } from "./state/store";
import { mountApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("PackMap app root was not found");
}

const store = createAppStore();
mountApp(root, store);
