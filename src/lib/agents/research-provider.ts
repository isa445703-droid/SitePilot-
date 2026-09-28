import "server-only";

/**
 * Research abstraction.
 *
 * The MVP ships with an explicitly-labelled mock provider because no search API
 * key is configured. Mock research is NEVER presented as real web research:
 * every result carries `isMock: true` and the provider name, which is stored on
 * the ResearchItem/ContentSource rows and shown in the UI.
 */

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
};

export interface ResearchProvider {
  readonly name: string;
  readonly isMock: boolean;
  search(query: string): Promise<SearchResult[]>;
}

export class MockResearchProvider implements ResearchProvider {
  readonly name = "mock";
  readonly isMock = true;

  async search(query: string): Promise<SearchResult[]> {
    return [
      {
        title: `Mock result for “${query}”`,
        url: "",
        snippet:
          "No search provider is configured (SEARCH_PROVIDER is empty). This entry is a development placeholder, not real web research.",
        provider: "mock",
      },
      {
        title: "Configure a provider to enable real research",
        url: "",
        snippet:
          "Implement ResearchProvider (see lib/agents/research-provider.ts) and set SEARCH_PROVIDER to collect real sources.",
        provider: "mock",
      },
    ];
  }
}

let provider: ResearchProvider | null = null;

export function getResearchProvider(): ResearchProvider {
  if (provider) return provider;
  const configured = process.env.SEARCH_PROVIDER ?? "";
  // Future: plug in `serpapi`, `brave`, `tavily`, … here.
  if (configured && configured !== "mock") {
    provider = new MockResearchProvider(); // real providers not installed in MVP
  } else {
    provider = new MockResearchProvider();
  }
  return provider;
}

/** Test seam. */
export function setResearchProvider(next: ResearchProvider | null) {
  provider = next;
}
