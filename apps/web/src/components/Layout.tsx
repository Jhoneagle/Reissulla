import { NavLink, Outlet, Link } from "react-router";
import { FormattedMessage, useIntl } from "react-intl";
import { navRoutes } from "../routes";
import { useAuthStore } from "../stores/auth";

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const intl = useIntl();

  return (
    <>
      <a href="#main-content" className="skip-link">
        <FormattedMessage id="app.skipToContent" />
      </a>
      <header>
        <h1>
          <FormattedMessage id="app.title" />
        </h1>
        <nav aria-label={intl.formatMessage({ id: "nav.mainNav" })}>
          <ul>
            {navRoutes.map(({ path, labelId }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === "/"}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <FormattedMessage id={labelId} />
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
                  <FormattedMessage id="nav.logOut" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <FormattedMessage id="nav.logIn" />
                </Link>
                <Link to="/register" className="btn-register">
                  <FormattedMessage id="nav.register" />
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
          <FormattedMessage
            id="footer.attribution.weatherBy"
            values={{
              provider: (
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FormattedMessage id="footer.providers.openMeteo" />
                </a>
              ),
            }}
          />{" "}
          <FormattedMessage
            id="footer.attribution.mapBy"
            values={{
              provider: (
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FormattedMessage id="footer.providers.osm" />
                </a>
              ),
            }}
          />
        </p>
      </footer>
    </>
  );
}
