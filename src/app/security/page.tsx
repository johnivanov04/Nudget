/**
 * Information Security Policy — served at /security so it has a stable public
 * URL for Plaid's Production security questionnaire (and any partner review).
 *
 * Every statement here reflects Nudget's ACTUAL implementation (AES-256-GCM at
 * rest, TLS in transit, per-user RLS, no stored bank credentials, financial-data
 * scrubbing, in-app deletion). Keep it truthful — update it if practices change.
 */
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Nudget — Information Security Policy',
  description: 'How Nudget secures user and financial data.',
};

const CONTACT_EMAIL = 'ivanov.john04@gmail.com';
const LAST_UPDATED = 'July 13, 2026';

function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 20, marginTop: '2rem', marginBottom: '0.5rem' }}>{children}</h2>;
}

export default function SecurityPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', color: '#111' }}>
      <h1 style={{ marginBottom: 0 }}>Information Security Policy</h1>
      <p style={{ color: '#777', marginTop: 4 }}>Nudget · Last updated: {LAST_UPDATED}</p>

      <H2>1. Purpose &amp; scope</H2>
      <p>
        This policy describes how Nudget protects the confidentiality, integrity, and availability of
        the data it processes — with particular care for the financial data accessed through Plaid. It
        applies to the Nudget backend, the iOS application, and all third-party systems used to operate
        the service.
      </p>

      <H2>2. Governance &amp; responsibility</H2>
      <p>
        Nudget is operated by its owner, who is responsible for information security and reviews
        security as part of design, development, and operations. Security questions or reports can be
        sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <H2>3. Data handled &amp; classification</H2>
      <ul>
        <li>
          <strong>Account data:</strong> email address and time zone.
        </li>
        <li>
          <strong>Financial data (sensitive):</strong> account balances, recent transactions, and
          account metadata retrieved via Plaid. Nudget <strong>never</strong> receives or stores bank
          login credentials.
        </li>
        <li>
          <strong>Secrets (highly sensitive):</strong> Plaid access tokens and device push tokens.
        </li>
      </ul>
      <p>Sensitive and secret data receive the strongest controls described below.</p>

      <H2>4. Encryption</H2>
      <ul>
        <li>
          <strong>In transit:</strong> all network traffic is served over HTTPS/TLS.
        </li>
        <li>
          <strong>At rest:</strong> Plaid access tokens and device tokens are encrypted with{' '}
          <strong>AES-256-GCM</strong> (authenticated encryption) before storage. Encryption keys are
          held as platform secrets, separate from the data, and are never committed to source control.
          Database storage is provided by Supabase with encryption at rest.
        </li>
      </ul>

      <H2>5. Access control</H2>
      <ul>
        <li>
          Per-user data isolation is enforced at the database layer with PostgreSQL{' '}
          <strong>Row-Level Security</strong>; a user can access only their own records.
        </li>
        <li>Authentication uses Supabase-issued JWTs with short-lived access tokens and refresh.</li>
        <li>
          Privileged, server-only operations use a service role that is never exposed to clients.
        </li>
        <li>Access to keys and data follows the principle of least privilege.</li>
      </ul>

      <H2>6. Credential &amp; secret management</H2>
      <ul>
        <li>
          No bank login credentials are ever collected or stored — authentication happens directly
          between the user and their bank through Plaid Link.
        </li>
        <li>
          Plaid access tokens are encrypted at rest, are never returned to the client, and are never
          written to logs.
        </li>
        <li>
          Application secrets (API keys, encryption keys) are stored as environment variables in the
          hosting platform and are excluded from source control.
        </li>
      </ul>

      <H2>7. Data minimization, retention &amp; deletion</H2>
      <ul>
        <li>Nudget collects only what it needs to compute a user&rsquo;s runway and detect bills.</li>
        <li>
          Error reports and analytics exclude raw financial details — amounts, balances, merchant
          names, tokens, and account numbers are removed by automated scrubbing before anything leaves
          the service.
        </li>
        <li>
          Users can delete their account and all associated data at any time from within the app;
          deletion cascades to linked banks, transactions, and derived data.
        </li>
      </ul>

      <H2>8. Logging &amp; monitoring</H2>
      <p>
        Application errors and crashes are captured via Sentry, with automated redaction of sensitive
        fields. Logs never contain access tokens or raw financial data.
      </p>

      <H2>9. Third-party / vendor management</H2>
      <p>Nudget relies on established providers, each with its own security program:</p>
      <ul>
        <li><strong>Plaid</strong> — secure bank connectivity.</li>
        <li><strong>Supabase</strong> — authentication and encrypted database hosting with backups.</li>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li><strong>Apple (APNs)</strong> — push-notification delivery.</li>
        <li><strong>Sentry</strong> — error and crash monitoring.</li>
      </ul>
      <p>Data shared with each provider is limited to what the provider needs to perform its function.</p>

      <H2>10. Secure development &amp; change management</H2>
      <ul>
        <li>Source code is version-controlled; changes go through review and automated testing before deployment.</li>
        <li>Dependencies are kept current, and known-vulnerable packages are patched promptly.</li>
        <li>No secrets are committed to source control.</li>
      </ul>

      <H2>11. Vulnerability management</H2>
      <p>
        Nudget runs on managed, serverless infrastructure (Vercel, Supabase); the underlying operating
        systems and server instances are maintained and patched by those providers. At the application
        level:
      </p>
      <ul>
        <li>
          <strong>Dependency scanning:</strong> third-party dependencies are continuously monitored for
          known vulnerabilities using automated tooling (<code>npm audit</code> and GitHub Dependabot
          alerts).
        </li>
        <li>
          <strong>Patching SLA:</strong> identified vulnerabilities are remediated on a risk-based
          timeline — critical and high-severity issues within 7 days of a fix becoming available, and
          lower-severity issues within 30 days.
        </li>
        <li>
          <strong>End-of-life software:</strong> runtimes and key dependencies are kept on actively
          supported versions (for example, current Node.js LTS and framework releases); deprecated or
          end-of-life components are monitored and replaced promptly.
        </li>
        <li>
          Security is also considered during code review for changes that touch data handling or
          authentication.
        </li>
      </ul>

      <H2>12. Business continuity &amp; backups</H2>
      <p>
        Database backups are provided by Supabase&rsquo;s managed platform, and the application is
        hosted on infrastructure with redundancy and high availability.
      </p>

      <H2>13. Incident response</H2>
      <p>
        In the event of a suspected security incident, the owner will assess the scope and impact,
        contain the issue, remediate the root cause, and notify affected users and relevant partners
        (including Plaid) as required by applicable law and agreements.
      </p>

      <H2>14. Policy review</H2>
      <p>
        This policy is reviewed periodically and updated as the product and its security practices
        evolve.
      </p>

      <H2>Contact</H2>
      <p>
        Security questions or disclosures: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </main>
  );
}
