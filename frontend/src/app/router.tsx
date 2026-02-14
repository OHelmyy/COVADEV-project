import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

import RequireAuth from "./RequireAuth";
import LoginPage from "../pages/LoginPage";
import AdminUsersPage from "../pages/AdminUsersPage";

import DashboardPage from "../pages/DashboardPage";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectCreatePage from "../pages/ProjectCreatePage";
import ProjectDetailPage from "../pages/ProjectDetailPage";
import ProjectMembersPage from "../pages/ProjectMembersPage";
import ProjectLogsPage from "../pages/ProjectLogsPage";

import ReportsPage from "../pages/ReportsPage";
import DevelopersPage from "../pages/DevelopersPage";
import ExportPage from "../pages/ExportPage";
import AdminDashboardPage from "../pages/AdminDashboardPage";
import HomeRedirect from "./HomeRedirect";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { path: "login", element: <LoginPage /> },

      // everything below requires login
      {
        index: true,
        element: (
          <HomeRedirect/>
        ),
      },

      {
        path: "projects",
        element: (
          <RequireAuth>
            <ProjectsPage />
          </RequireAuth>
        ),
      },

      // Admin-only
      {
        path: "admin",
        element: (
          <RequireAuth roles={["ADMIN"]}>
            <AdminDashboardPage />
          </RequireAuth>
        ),
      },

      
      {
        path: "projects/create",
        element: (
          <RequireAuth roles={["ADMIN"]}>
            <ProjectCreatePage />
          </RequireAuth>
        ),
      },


      {
        path: "projects/:projectId",
        element: (
          <RequireAuth>
            <ProjectDetailPage />
          </RequireAuth>
        ),
      },

      // evaluator/admin only (members + logs)
      {
        path: "projects/:projectId/members",
        element: (
          <RequireAuth roles={["ADMIN", "EVALUATOR"]}>
            <ProjectMembersPage />
          </RequireAuth>
        ),
      },
      {
        path: "projects/:projectId/logs",
        element: (
          <RequireAuth roles={["ADMIN", "EVALUATOR"]}>
            <ProjectLogsPage />
          </RequireAuth>
        ),
      },

      // evaluator/admin only
      {
        path: "users",
        element: (
          <RequireAuth roles={["ADMIN"]}>
            <AdminUsersPage />
          </RequireAuth>
        ),
      },
      {
        path: "reports",
        element: (
          <RequireAuth roles={["ADMIN", "EVALUATOR"]}>
            <ReportsPage />
          </RequireAuth>
        ),
      },
      {
        path: "developers",
        element: (
          <RequireAuth roles={["ADMIN", "EVALUATOR"]}>
            <DevelopersPage />
          </RequireAuth>
        ),
      },
      {
        path: "export",
        element: (
          <RequireAuth roles={["ADMIN", "EVALUATOR"]}>
            <ExportPage />
          </RequireAuth>
        ),
      },
    ],
  },
]);