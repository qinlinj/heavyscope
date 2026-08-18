import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DatabaseProvider } from "@/hooks/useDatabase";
import { Dashboard } from "@/pages/Dashboard";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";

export default function App() {
  return (
    <DatabaseProvider>
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
    </DatabaseProvider>
  );
}
