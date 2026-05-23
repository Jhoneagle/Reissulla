import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { Persona } from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";
import { usePersonaStore } from "../stores/persona";
import { usePreferences, useUpdatePreferences } from "../hooks/usePreferences";
import { Modal } from "./Modal";

/**
 * Skippable 3-question intro that captures the highest-value persona
 * flags — wheelchair routing, screen-reader usage, stroller routing.
 * Other persona fields can be tuned later in Settings. Roadmap ID-6.
 *
 * Storage:
 * - Authenticated users: PATCH preferences.extra.persona (merged with
 *   whatever is already there).
 * - Anonymous users: persona store (localStorage-backed).
 *
 * The wizard is presentational — callers control mounting. Register.tsx
 * shows it after sign-up; Settings.tsx exposes an "open wizard" button
 * for users who skipped it.
 */
export interface PersonaWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

// Persona keys with boolean values — `language` is excluded so the
// wizard's resolved-answer map can type-safely assign booleans.
type BooleanPersonaKey = Exclude<keyof Persona, "language">;

interface Question {
  id: BooleanPersonaKey;
  labelId: string;
}

const QUESTIONS: Question[] = [
  { id: "wheelchair", labelId: "personaWizard.questions.wheelchair" },
  { id: "screenReader", labelId: "personaWizard.questions.screenReader" },
  { id: "stroller", labelId: "personaWizard.questions.stroller" },
];

export function PersonaWizard({ isOpen, onClose }: PersonaWizardProps) {
  const user = useAuthStore((s) => s.user);
  const personaStore = usePersonaStore();
  const preferencesQuery = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const intl = useIntl();

  const [step, setStep] = useState(0);
  // null = unanswered (treated as "no" if user skips through)
  const [answers, setAnswers] = useState<
    Record<BooleanPersonaKey, boolean | null>
  >(
    () =>
      Object.fromEntries(QUESTIONS.map((q) => [q.id, null])) as Record<
        BooleanPersonaKey,
        boolean | null
      >,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentQuestion = QUESTIONS[step]!;
  const isFirstStep = step === 0;
  const isLastStep = step === QUESTIONS.length - 1;

  function answer(value: boolean) {
    setAnswers((s) => ({ ...s, [currentQuestion.id]: value }));
  }

  function next() {
    if (isLastStep) {
      void persistAndClose();
    } else {
      setStep((s) => s + 1);
    }
  }

  async function persistAndClose() {
    setSaveError(null);
    const resolved: Partial<Persona> = {};
    for (const q of QUESTIONS) {
      resolved[q.id] = answers[q.id] === true;
    }
    // Merge into the local store first — that's the wire-header source of
    // truth, and writing here means even a failed server PATCH doesn't lose
    // the user's choices.
    personaStore.set(resolved);

    if (user) {
      try {
        const existingExtra = preferencesQuery.data?.extra ?? {};
        await updatePreferences.mutateAsync({
          extra: {
            ...existingExtra,
            persona: { ...personaStore.persona, ...resolved },
          },
        });
      } catch {
        setSaveError(intl.formatMessage({ id: "personaWizard.saveError" }));
        return;
      }
    }
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="persona-wizard-heading"
      className="persona-wizard"
    >
      <h2 id="persona-wizard-heading">
        <FormattedMessage id="personaWizard.heading" />
      </h2>
      <p className="persona-wizard-intro">
        <FormattedMessage id="personaWizard.intro" />
      </p>
      <p className="persona-wizard-step" aria-live="polite">
        <FormattedMessage
          id="personaWizard.step"
          values={{ current: step + 1, total: QUESTIONS.length }}
        />
      </p>

      <fieldset>
        <legend>
          <FormattedMessage id={currentQuestion.labelId} />
        </legend>
        <div className="persona-wizard-choice">
          <button
            type="button"
            onClick={() => answer(true)}
            aria-pressed={answers[currentQuestion.id] === true}
            className={
              answers[currentQuestion.id] === true ? "selected" : undefined
            }
          >
            <FormattedMessage id="personaWizard.yes" />
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            aria-pressed={answers[currentQuestion.id] === false}
            className={
              answers[currentQuestion.id] === false ? "selected" : undefined
            }
          >
            <FormattedMessage id="personaWizard.no" />
          </button>
        </div>
      </fieldset>

      {saveError && (
        <div role="alert" className="form-error">
          {saveError}
        </div>
      )}

      <div className="persona-wizard-nav">
        <button type="button" onClick={onClose} className="link-button">
          <FormattedMessage id="personaWizard.skipAll" />
        </button>
        <div className="persona-wizard-nav-right">
          {!isFirstStep && (
            <button type="button" onClick={() => setStep((s) => s - 1)}>
              <FormattedMessage id="personaWizard.previous" />
            </button>
          )}
          <button type="button" onClick={next}>
            <FormattedMessage
              id={isLastStep ? "personaWizard.finish" : "personaWizard.next"}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}
