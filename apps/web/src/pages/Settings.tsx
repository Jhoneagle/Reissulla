import { FormattedMessage } from "react-intl";

export function Settings() {
  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading">
        <FormattedMessage id="settings.heading" />
      </h2>
      <p>
        <FormattedMessage id="settings.placeholder" />
      </p>
    </section>
  );
}
