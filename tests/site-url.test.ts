import { afterEach, describe, expect, it } from "vitest";
import { siteAddressing, siteHref, siteOrigin, siteSlugFromHost } from "@/lib/site-url";

const original = process.env.SITE_ADDRESSING;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (original === undefined) delete process.env.SITE_ADDRESSING;
  else process.env.SITE_ADDRESSING = original;
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("siteAddressing", () => {
  it("uses subdomains on a normal custom domain", () => {
    expect(siteAddressing("https://sitepilot.app")).toBe("subdomain");
  });

  it("falls back to paths on hosts that cannot serve wildcards", () => {
    expect(siteAddressing("https://sitepilot-omega-eight.vercel.app")).toBe("path");
    expect(siteAddressing("https://site.pages.dev")).toBe("path");
  });

  it("lets SITE_ADDRESSING force either mode", () => {
    process.env.SITE_ADDRESSING = "path";
    expect(siteAddressing("https://sitepilot.app")).toBe("path");
    process.env.SITE_ADDRESSING = "subdomain";
    expect(siteAddressing("https://sitepilot-omega-eight.vercel.app")).toBe("subdomain");
  });
});

describe("siteOrigin / siteHref", () => {
  it("builds a subdomain origin by default", () => {
    expect(siteOrigin("nordic-explorer", "https://sitepilot.app")).toBe(
      "https://nordic-explorer.sitepilot.app",
    );
  });

  it("keeps the port for local development", () => {
    expect(siteOrigin("demo", "http://localhost:3000")).toBe("http://demo.localhost:3000");
  });

  it("uses the path form on Vercel hosts", () => {
    const appUrl = "https://sitepilot-omega-eight.vercel.app";
    expect(siteOrigin("nordic-explorer", appUrl)).toBe(
      "https://sitepilot-omega-eight.vercel.app/s/nordic-explorer",
    );
    expect(siteHref("nordic-explorer", "/sitemap.xml", appUrl)).toBe(
      "https://sitepilot-omega-eight.vercel.app/s/nordic-explorer/sitemap.xml",
    );
  });

  it("keeps the trailing slash only for the home page", () => {
    const appUrl = "https://sitepilot.app";
    expect(siteHref("blog", "/", appUrl)).toBe("https://blog.sitepilot.app/");
    expect(siteHref("blog", "/a/hello", appUrl)).toBe("https://blog.sitepilot.app/a/hello");
  });
});

describe("siteSlugFromHost", () => {
  it("extracts a site slug from a site subdomain", () => {
    expect(siteSlugFromHost("nordic-explorer.sitepilot.app", "https://sitepilot.app")).toBe("nordic-explorer");
  });

  it("ignores the apex, www and unrelated hosts", () => {
    expect(siteSlugFromHost("sitepilot.app", "https://sitepilot.app")).toBeNull();
    expect(siteSlugFromHost("www.sitepilot.app", "https://sitepilot.app")).toBeNull();
    expect(siteSlugFromHost("example.com", "https://sitepilot.app")).toBeNull();
    expect(siteSlugFromHost(null, "https://sitepilot.app")).toBeNull();
  });

  it("ignores labels that are not slug shaped", () => {
    expect(siteSlugFromHost("_dmarc.sitepilot.app", "https://sitepilot.app")).toBeNull();
  });
});
