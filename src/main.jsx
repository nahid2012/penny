import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { defineCustomElements } from "jeep-sqlite-current-sqljs/loader";

import App from "./App.jsx";

async function bootstrap() {
  if (Capacitor.getPlatform() === "web") {
    defineCustomElements(window);

    await customElements.whenDefined("jeep-sqlite");

    let jeep = document.querySelector("jeep-sqlite");

    if (!jeep) {
      jeep = document.createElement("jeep-sqlite");
      document.body.appendChild(jeep);
    }

    const sqlite = new SQLiteConnection(CapacitorSQLite);
    await sqlite.initWebStore();
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap().catch((error) => {
  console.error("App bootstrap failed:", error);
});
