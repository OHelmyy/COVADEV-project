import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

import DashboardPage from "../pages/DashboardPage";
import ProjectsPage from "../pages/ProjectsPage";
import ReportsPage from "../pages/ReportsPage";
import DevelopersPage from "../pages/DevelopersPage";
import ExportPage from "../pages/ExportPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "developers", element: <DevelopersPage /> },
      { path: "export", element: <ExportPage /> },
    ],
  },
]);
