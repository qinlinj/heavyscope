import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorState } from "@/components/ErrorState";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemeSync } from "@/components/ThemeSync";
import { DatabaseProvider, useDatabase } from "@/hooks/useDatabase";
import { desktopShellMode, isDesktopShell } from "@/lib/desktop";
import { Dashboard } from "@/pages/Dashboard";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";
import { TrayPage } from "@/pages/Tray";

function AppRoutes() {
  const { error } = useDatabase();
  const [accessory, setAccessory] = useState<boolean | null>(() =>
    isDesktopShell() ? null : false,
  );

  useEffect(() => {
    if (!isDesktopShell()) return;
    void desktopShellMode().then((mode) => {
      setAccessory(mode === "accessory");
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-5 sm:px-6">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  if (accessory === null) {
    return <div className="min-h-svh bg-background" />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tray" element={<TrayPage />} />
        {accessory ? (
          <Route path="*" element={<TrayPage />} />
        ) : (
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <DatabaseProvider>
      <ThemeSync />
      <AppRoutes />
    </DatabaseProvider>
  );
}
