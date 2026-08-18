import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorState } from "@/components/ErrorState";
import { AppLayout } from "@/components/layout/AppLayout";
import { DatabaseProvider, useDatabase } from "@/hooks/useDatabase";
import { Dashboard } from "@/pages/Dashboard";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";

function AppRoutes() {
  const { error } = useDatabase();
  if (error) {
    return (
      <div className="dark min-h-svh bg-background text-foreground">
        <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-5 sm:px-6">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <DatabaseProvider>
      <AppRoutes />
    </DatabaseProvider>
  );
}
