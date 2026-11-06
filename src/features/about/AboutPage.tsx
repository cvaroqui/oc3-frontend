import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useApiVersion } from "@/lib/api/api-docs";
import opensvcLogo from "@/assets/opensvc-logo.svg";

/** The publisher, and where to reach it. */
const PUBLISHER = {
  name: "OpenSVC SAS",
  site: "https://www.opensvc.com",
  contact: "contact@opensvc.com",
  support: "support@opensvc.com",
};

/** The sources: the collector and this interface. */
const SOURCES = [
  { name: "oc3", url: "https://github.com/opensvc/oc3", license: undefined },
  { name: "oc3-frontend", url: "https://github.com/opensvc/oc3-frontend", license: "Apache-2.0" },
];

/**
 * The software this interface bundles, each under its own license, as their packages
 * say (package.json, its dependencies): kept with them when one is added or removed.
 */
const BUNDLED = [
  ["React, React DOM", "MIT"],
  ["TanStack Query, Router, Table, Virtual", "MIT"],
  ["i18next, react-i18next", "MIT"],
  ["openapi-fetch", "MIT"],
  ["clsx, tailwind-merge", "MIT"],
  ["IBM Plex Sans", "OFL-1.1"],
] as const;

const LINK = "text-accent underline-offset-2 hover:underline";

function Mail({ to }: { to: string }) {
  return (
    <a className={LINK} href={`mailto:${to}`}>
      {to}
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`about-${id}`} className="space-y-2">
      <h2 id={`about-${id}`} className="font-semibold">
        {title}
      </h2>
      <div className="space-y-2 text-ink-muted [&_strong]:text-ink">{children}</div>
    </section>
  );
}

/**
 * About the collector: the product, its publisher, the licenses and the sources, then
 * what the law of the European Union asks to be told: the personal data handled
 * (GDPR), what the browser keeps (ePrivacy), the accessibility, where to report a
 * vulnerability. Open to all, signed in or not (`AppShell`).
 */
export function AboutPage() {
  const { t } = useTranslation();
  const apiVersion = useApiVersion().data?.version;
  const support = <Mail to={PUBLISHER.support} />;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-title font-semibold tracking-tight">
          <img src={opensvcLogo} alt="" width={28} height={28} className="h-7 w-7" />
          OpenSVC Collector
        </h1>
        <p className="text-ink-muted">{t("about.tagline")}</p>
        {__APP_VERSION__ !== "" && (
          <p>
            <span className="text-ink-muted">{t("about.interface")}</span>{" "}
            <span className="font-mono">{__APP_VERSION__}</span>
          </p>
        )}
        {apiVersion !== undefined && (
          <p>
            <span className="text-ink-muted">{t("about.api")}</span>{" "}
            <span className="font-mono">{apiVersion}</span>
          </p>
        )}
      </header>

      <Section id="publisher" title={t("about.publisher.title")}>
        <p>
          <strong>{PUBLISHER.name}</strong> ·{" "}
          <a className={LINK} href={PUBLISHER.site}>
            {PUBLISHER.site.replace("https://", "")}
          </a>
        </p>
        <p>
          {t("about.publisher.contact")} <Mail to={PUBLISHER.contact} /> ·{" "}
          {t("about.publisher.support")} {support}
        </p>
      </Section>

      <Section id="licenses" title={t("about.licenses.title")}>
        <ul className="space-y-0.5">
          {SOURCES.map((source) => (
            <li key={source.name}>
              <a className={`${LINK} font-mono`} href={source.url}>
                {source.name}
              </a>
              {source.license !== undefined && (
                <span> · {t("about.licenses.under", { license: source.license })}</span>
              )}
            </li>
          ))}
        </ul>
        <p>{t("about.licenses.bundled")}</p>
        <ul className="grid gap-x-4 sm:grid-cols-2">
          {BUNDLED.map(([name, license]) => (
            <li key={name}>
              <span className="text-ink">{name}</span> · {license}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="privacy" title={t("about.privacy.title")}>
        <p>{t("about.privacy.none")}</p>
        <p>{t("about.privacy.controller")}</p>
        <p>{t("about.privacy.browser")}</p>
        <p>{t("about.privacy.oidc")}</p>
        <p>{t("about.privacy.assistant")}</p>
        <p>
          {t("about.privacy.rights")} {support}
        </p>
      </Section>

      <Section id="cookies" title={t("about.cookies.title")}>
        <p>{t("about.cookies.text")}</p>
      </Section>

      <Section id="accessibility" title={t("about.accessibility.title")}>
        <p>
          {t("about.accessibility.text")} {support}
        </p>
      </Section>

      <Section id="security" title={t("about.security.title")}>
        <p>
          {t("about.security.text")} {support}
        </p>
      </Section>
    </div>
  );
}
