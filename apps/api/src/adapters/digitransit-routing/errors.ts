export type DigitransitErrorCause = "http" | "graphql" | "timeout" | "network";

export class DigitransitError extends Error {
  constructor(
    public readonly source: string,
    public readonly cause: DigitransitErrorCause,
    message: string,
  ) {
    super(message);
    this.name = "DigitransitError";
  }
}
