import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

import RequireAuth from "./RequireAuth";
import LoginPage from "../pages/LoginPage";
import AdminUsersPage from "../pages/AdminUsersPage";


import ProjectsPage from "../pages/ProjectsPage";
import ProjectCreatePage from "../pages/ProjectCreatePage";
import ProjectDetailPage from "../features/projects/pages/ProjectDetailPage";
import ProjectMembersPage from "../pages/ProjectMembersPage";
import ProjectLogsPage from "../pages/ProjectLogsPage";
import MyTasksPage from "../features/task-management/components/MyTasksPage";  

import ReportsPage from "../pages/ReportsPage";
import DevelopersPage from "../pages/DevelopersPage";
import ExportPage from "../pages/ExportPage";
import AdminDashboardPage from "../pages/AdminDashboardPage";
import HomeRedirect from "./HomeRedirect";
import DeveloperPerformancePage from "../pages/DeveloperPerformancePage";
import MyInsightsPage from "../pages/MyInsightsPage";

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

      {
        path: "myTasks",
        element: (
          <RequireAuth>
            <MyTasksPage />
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
        path: "/my-insights",
        element: (
          <RequireAuth>
            <MyInsightsPage />
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
      {
        path: "/developer-performance",
        element: (
          <RequireAuth>
            <DeveloperPerformancePage />
          </RequireAuth>
        ),
      }
    ],
  },
]);