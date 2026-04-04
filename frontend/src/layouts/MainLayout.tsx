import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function MainLayout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top right, rgba(6,182,212,0.06), transparent 20%), radial-gradient(circle at top left, rgba(109,40,217,0.05), transparent 18%), #f4f7fb",
      }}
    >
      <Navbar />
      <main style={{ maxWidth: 1220, margin: "28px auto", padding: "0 18px 32px" }}>
        <Outlet />
      </main>
    </div>
  );
}