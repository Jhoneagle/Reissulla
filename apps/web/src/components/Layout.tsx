import { NavLink, Outlet, Link } from "react-router";
import { navRoutes } from "../routes";
import { useAuthStore } from "../stores/auth";

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header>
        <h1>Reissulla</h1>
        <nav aria-label="Main navigation">
          <ul>
            {navRoutes.map(({ path, label }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === "/"}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {!loading && (
          <div className="auth-nav">
            {user ? (
              <>
                <span className="user-name">{user.name}</span>
                <button type="button" onClick={signOut}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/register" className="btn-register">
                  Register
                </Link>
              </>
            )}
          </div>
        )}
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer>
        <p>
          Weather data by{" "}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open-Meteo
          </a>
          . Map data &copy;{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap contributors
          </a>
          .
        </p>
      </footer>
    </>
  );
}
