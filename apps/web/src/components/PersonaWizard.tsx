import { useId, useRef, useState, type KeyboardEvent } from "react";
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
      <p className="persona-wizard-step">
        <FormattedMessage
          id="personaWizard.step"
          values={{ current: step + 1, total: QUESTIONS.length }}
        />
      </p>

      <YesNoRadioGroup
        questionLabelId={currentQuestion.labelId}
        value={answers[currentQuestion.id]}
        onChange={answer}
      />

      {saveError && (
        <div role="alert" className="form-error">
          {saveError}
        </div>
      )}

      <div className="persona-wizard-nav">
        <button type="button" onClick={onClose} className="btn btn--link">
          <FormattedMessage id="personaWizard.skipAll" />
        </button>
        <div className="persona-wizard-nav-right">
          {!isFirstStep && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="btn btn--secondary"
            >
              <FormattedMessage id="personaWizard.previous" />
            </button>
          )}
          <button type="button" onClick={next} className="btn btn--primary">
            <FormattedMessage
              id={isLastStep ? "personaWizard.finish" : "personaWizard.next"}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Native-feel yes/no radio group with arrow-key roving focus. We don't
 * use `<input type="radio">` because the buttons carry custom selected
 * styling and a click should both select and (in W3.3) auto-advance — a
 * hidden input would split focus management between the input and the
 * visible button. ARIA `radio` semantics with explicit roving tabindex
 * is the documented WAI-ARIA APG pattern for exactly this case.
 */
function YesNoRadioGroup({
  questionLabelId,
  value,
  onChange,
}: {
  questionLabelId: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  const groupLabelId = useId();
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);

  // Roving tabindex: only the active option (or the first one when
  // nothing is selected yet) is in the Tab sequence. Arrow keys move
  // both focus and selection between options.
  const yesIsTabStop = value === true || value === null;
  const noIsTabStop = value === false;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      return;
    }
    e.preventDefault();
    const next = value === true ? false : true;
    onChange(next);
    (next ? yesRef : noRef).current?.focus();
  }

  return (
    <fieldset>
      <legend id={groupLabelId}>
        <FormattedMessage id={questionLabelId} />
      </legend>
      {/* WAI-ARIA APG: radiogroup container is not focusable — focus
          rests on one of its radio children at a time (roving tabindex). */}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
      <div
        role="radiogroup"
        aria-labelledby={groupLabelId}
        className="persona-wizard-choice"
        onKeyDown={handleKeyDown}
      >
        <button
          ref={yesRef}
          type="button"
          role="radio"
          aria-checked={value === true}
          tabIndex={yesIsTabStop ? 0 : -1}
          onClick={() => onChange(true)}
          className={value === true ? "selected" : undefined}
        >
          <FormattedMessage id="personaWizard.yes" />
        </button>
        <button
          ref={noRef}
          type="button"
          role="radio"
          aria-checked={value === false}
          tabIndex={noIsTabStop ? 0 : -1}
          onClick={() => onChange(false)}
          className={value === false ? "selected" : undefined}
        >
          <FormattedMessage id="personaWizard.no" />
        </button>
      </div>
    </fieldset>
  );
}
