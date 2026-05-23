import { FormattedMessage } from "react-intl";

export function Dashboard() {
  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading">
        <FormattedMessage id="dashboard.heading" />
      </h2>
      <p>
        <FormattedMessage id="dashboard.placeholder" />
      </p>
    </section>
  );
}
