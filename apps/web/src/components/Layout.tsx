import { NavLink, Outlet } from "react-router";
import { routes } from "../routes";

export function Layout() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header>
        <h1>Reissulla</h1>
        <nav aria-label="Main navigation">
          <ul>
            {routes.map(({ path, label }) => (
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
