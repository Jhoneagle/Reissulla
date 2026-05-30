import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router";
import en from "../i18n/messages-en.json";
import fi from "../i18n/messages-fi.json";

type Locale = "fi" | "en";

const CATALOGUES: Record<Locale, Record<string, string>> = { en, fi };

interface ProvidersOptions {
  locale?: Locale;
  initialEntries?: string[];
  queryClient?: QueryClient;
}

export type ProvidersRenderResult = RenderResult & { queryClient: QueryClient };

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function AllProviders({
  children,
  locale = "en",
  initialEntries = ["/"],
  queryClient,
}: ProvidersOptions & { children: ReactNode }) {
  const client = queryClient ?? makeQueryClient();
  return (
    <QueryClientProvider client={client}>
      <IntlProvider
        locale={locale}
        messages={CATALOGUES[locale]}
        defaultLocale="en"
      >
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  {
    locale,
    initialEntries,
    queryClient,
    ...rtlOptions
  }: ProvidersOptions & Omit<RenderOptions, "wrapper"> = {},
): ProvidersRenderResult {
  const client = queryClient ?? makeQueryClient();
  const rendered = render(ui, {
    wrapper: ({ children }) => (
      <AllProviders
        locale={locale}
        initialEntries={initialEntries}
        queryClient={client}
      >
        {children}
      </AllProviders>
    ),
    ...rtlOptions,
  });
  return { ...rendered, queryClient: client };
}
