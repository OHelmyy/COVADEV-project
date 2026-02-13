// src/app/RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import { type Role } from "../api/auth";
import { useAuth } from "./auth";
import type { JSX } from "react";

export default function RequireAuth({
  roles,
  children,
}: {
  roles?: Role[];
  children: JSX.Element;
}) {
  const { loading, user } = useAuth();
  const loc = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    // simple fallback
    return <Navigate to="/projects" replace />;
  }

  return children;
}