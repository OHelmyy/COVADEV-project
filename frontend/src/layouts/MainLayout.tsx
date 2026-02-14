import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function MainLayout() {
  return (
    <div>
      <Navbar />
      <main style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px" }}>
        <Outlet />
      </main>
    </div>
  );
}
