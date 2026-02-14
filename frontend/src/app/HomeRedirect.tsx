import { Navigate } from "react-router-dom";
import { useAuth } from "./auth";

export default function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  if (!user) return <Navigate to="/login" replace />;

  // 🔥 Role-based redirect
  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  // Evaluator & Developer
  return <Navigate to="/projects" replace />;
}