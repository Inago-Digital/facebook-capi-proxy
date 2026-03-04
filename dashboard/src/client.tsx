/// <reference types="vite/client" />

import { hydrateRoot } from "react-dom/client"

import { App } from "./components/App.11ty"

const root = document.getElementById("root")
if (root) {
  hydrateRoot(root, <App />)
}
