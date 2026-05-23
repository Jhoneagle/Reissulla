import { config } from "../../config.js";
import type { AdapterContext } from "../types.js";
import { DigitransitError } from "./errors.js";
import type { GraphQLResponse } from "./types.js";

const FETCH_TIMEOUT_MS = 10_000;

export interface GraphQLClient {
  readonly source: string;
  readonly url: string;
  graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    ctx: AdapterContext,
  ): Promise<T>;
}

function apiKeyHeaders(): Record<string, string> {
  return config.digitransitApiKey
    ? { "digitransit-subscription-key": config.digitransitApiKey }
    : {};
}

export function createGraphQLClient(source: string, url: string): GraphQLClient {
  return {
    source,
    url,
    async graphql<T>(
      query: string,
      variables: Record<string, unknown>,
      ctx: AdapterContext,
    ): Promise<T> {
      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const signal = AbortSignal.any([ctx.signal, timeoutSignal]);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...apiKeyHeaders(),
          },
          body: JSON.stringify({ query, variables }),
          signal,
        });
      } catch (err) {
        if (timeoutSignal.aborted) {
          throw new DigitransitError(
            source,
            "timeout",
            `Digitransit ${source} timed out after ${FETCH_TIMEOUT_MS}ms`,
          );
        }
        throw new DigitransitError(
          source,
          "network",
          `Digitransit ${source} network error: ${(err as Error).message}`,
        );
      }

      if (!res.ok) {
        throw new DigitransitError(
          source,
          "http",
          `Digitransit ${source} HTTP ${res.status} ${res.statusText}`,
        );
      }

      const json: GraphQLResponse<T> = await res.json();

      if (json.errors?.length) {
        throw new DigitransitError(
          source,
          "graphql",
          `Digitransit ${source} GraphQL error: ${json.errors[0]!.message}`,
        );
      }

      return json.data;
    },
  };
}
