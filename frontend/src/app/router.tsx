// frontend/src/app/router.tsx
import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

import DashboardPage from "../pages/DashboardPage";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectCreatePage from "../pages/ProjectCreatePage";
import ProjectDetailPage from "../pages/ProjectDetailPage";
import ProjectMembersPage from "../pages/ProjectMembersPage";
import ProjectLogsPage from "../pages/ProjectLogsPage";

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
      { path: "projects/create", element: <ProjectCreatePage /> },
      { path: "projects/:projectId", element: <ProjectDetailPage /> },
      { path: "projects/:projectId/members", element: <ProjectMembersPage /> },
      { path: "projects/:projectId/logs", element: <ProjectLogsPage /> },

      { path: "reports", element: <ReportsPage /> },
      { path: "developers", element: <DevelopersPage /> },
      { path: "export", element: <ExportPage /> },
    ],
  },
]);
