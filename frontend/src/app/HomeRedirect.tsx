import { Navigate } from "react-router-dom";
import { useAuth } from "./auth";

export default function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === "DEVELOPER") {
    return <Navigate to="/my-insights" replace />;
  }

  if (user.role === "EVALUATOR") {
    return <Navigate to="/projects" replace />;
  }

  return <Navigate to="/login" replace />;
}