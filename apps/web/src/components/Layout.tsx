import { NavLink, Outlet, Link, useLocation } from "react-router";
import { FormattedMessage, useIntl } from "react-intl";
import { routes, navRoutes } from "../routes";
import { useAuthStore } from "../stores/auth";
import { Wordmark } from "./Wordmark";
import { PageHeading } from "./PageHeading";
import { Toast } from "./Toast";

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const intl = useIntl();
  // PageHeading owns the route-change focus target now — it focuses the
  // hidden h1 so SR announce the new page title. The legacy
  // useFocusOnRouteChange() pointed at #main-content; PageHeading
  // replaces it.

  // Resolve the current route's title for the page-level h1. Wordmark
  // is an SVG (role="img"), not a heading, so each route still needs
  // its own h1 landmark for SR navigation.
  const location = useLocation();
  const activeRoute = routes.find((r) =>
    r.path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(r.path),
  );
  const pageTitleId = activeRoute?.labelId ?? "app.title";

  return (
    <>
      <a href="#main-content" className="skip-link">
        <FormattedMessage id="app.skipToContent" />
      </a>
      <header>
        <Wordmark />
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
                <span className="user-name hide-on-mobile">{user.name}</span>
                <button
                  type="button"
                  onClick={signOut}
                  className="btn btn--secondary btn--sm"
                >
                  <FormattedMessage id="nav.logOut" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">
                  <FormattedMessage id="nav.logIn" />
                </Link>
                <Link
                  to="/register"
                  className="btn btn--primary btn--sm hide-on-mobile"
                >
                  <FormattedMessage id="nav.register" />
                </Link>
              </>
            )}
          </div>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        <PageHeading id={pageTitleId} />
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
      <Toast />
    </>
  );
}
