import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import "./i18n";
import "./index.css";

const stored = localStorage.getItem("heavyscope.lang") ?? "zh-CN";
document.documentElement.lang = stored;
applyTheme(readStoredTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
