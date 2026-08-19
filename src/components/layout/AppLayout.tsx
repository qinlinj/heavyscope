import { Gauge, History, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";
import { LanguageToggle } from "@/components/LanguageToggle";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", key: "nav.dashboard", icon: Gauge },
  { to: "/history", key: "nav.history", icon: History },
  { to: "/settings", key: "nav.settings", icon: Settings2 },
] as const;

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="dark min-h-svh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_oklch(0.28_0.04_250/_0.45),_transparent_55%)]" />
      <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-5 sm:px-6">
        <header data-tauri-drag-region className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-black/20">
              <Gauge className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-base font-semibold tracking-tight">
                {t("app.name")}
              </h1>
              <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex items-center gap-1 rounded-xl bg-card/80 p-1 ring-1 ring-foreground/10 backdrop-blur">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <link.icon className="size-4" />
                  {t(link.key)}
                </NavLink>
              ))}
            </nav>
            <LanguageToggle />
          </div>
        </header>
        <main className="flex-1 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
