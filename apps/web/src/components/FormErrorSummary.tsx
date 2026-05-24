import { useEffect, useRef } from "react";
import { FormattedMessage } from "react-intl";

interface FormErrorSummaryProps {
  errors: string[];
  /** Stable id for `aria-describedby` references on form inputs. */
  id?: string;
}

/**
 * Focus-jumping aria-live error summary (A11Y-26).
 *
 * Forms render this near the top and dispatch an array of error messages
 * after submit. The component:
 *   - renders nothing when `errors` is empty
 *   - shows a single error inline when there's exactly one
 *   - shows a heading + bulleted list when there are several
 *   - moves keyboard focus into itself whenever the error set transitions
 *     from empty to non-empty, so screen-reader users hear the alert
 *     immediately and sighted users see the page scroll to it
 */
export function FormErrorSummary({
  errors,
  id = "form-error-summary",
}: FormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const previousLength = useRef(errors.length);

  useEffect(() => {
    if (previousLength.current === 0 && errors.length > 0) {
      ref.current?.focus();
    }
    previousLength.current = errors.length;
  }, [errors]);

  if (errors.length === 0) return null;

  return (
    // role="alert" already implies aria-live="assertive" — declaring both
    // makes some screen readers double-announce.
    <div
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className="form-error-summary"
    >
      {errors.length === 1 ? (
        errors[0]
      ) : (
        <>
          <h2>
            <FormattedMessage id="forms.errorSummary.heading" />
          </h2>
          <ul>
            {errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
