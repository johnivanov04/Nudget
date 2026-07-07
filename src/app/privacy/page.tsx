/**
 * Privacy Policy page — served at /privacy so it has a stable public URL for the
 * App Store / TestFlight (and is linked from the app's Settings → About).
 *
 * Written to match Nudget's ACTUAL data practices. Not legal advice — review and
 * adjust for your jurisdiction (and confirm the contact address) before relying
 * on it for a public App Store submission.
 */
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Nudget — Privacy Policy',
  description: 'How Nudget collects, uses, and protects your information.',
};

const CONTACT_EMAIL = 'ivanov.john04@gmail.com';
const LAST_UPDATED = 'July 6, 2026';

function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 20, marginTop: '2rem', marginBottom: '0.5rem' }}>{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', color: '#111' }}>
      <h1 style={{ marginBottom: 0 }}>Privacy Policy</h1>
      <p style={{ color: '#777', marginTop: 4 }}>Last updated: {LAST_UPDATED}</p>

      <p>
        Nudget (&ldquo;Nudget,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) helps you answer one question
        — <em>&ldquo;Am I safe to spend before payday?&rdquo;</em> — by showing your safe-to-spend
        amount, upcoming bills, and daily allowance. This policy explains what we collect, how we use
        it, and the choices you have. We built Nudget to be privacy-first, and we do{' '}
        <strong>not</strong> sell your data or use it for advertising.
      </p>

      <H2>Information we collect</H2>
      <ul>
        <li>
          <strong>Account information.</strong> Your email address (to create and secure your
          account) and your time zone (to compute your runway correctly).
        </li>
        <li>
          <strong>Financial data via Plaid.</strong> When you connect a bank, you authenticate
          directly with your bank through Plaid. <strong>We never see or store your bank login
          credentials.</strong> Through Plaid we receive account information (name, type, last four
          digits, balances) and recent transactions, which we use to calculate your runway and detect
          recurring bills.
        </li>
        <li>
          <strong>Payday details you provide.</strong> Your pay frequency and last payday, to project
          your next payday.
        </li>
        <li>
          <strong>Notification data.</strong> If you enable notifications, a device push token so we
          can send your nudges. It is stored encrypted and as a one-way hash — never in plain form.
        </li>
        <li>
          <strong>Limited diagnostic &amp; usage data.</strong> Basic operational logs and
          privacy-preserving usage events to keep the app working and improve it. These exclude raw
          financial details such as exact balances, transaction amounts, and merchant names.
        </li>
      </ul>

      <H2>How we use your information</H2>
      <ul>
        <li>Calculate your safe-to-spend, daily allowance, and runway to payday.</li>
        <li>Detect recurring bills and estimate what&rsquo;s due before payday.</li>
        <li>Send the nudges and notifications you&rsquo;ve enabled.</li>
        <li>Operate, secure, troubleshoot, and improve the service.</li>
      </ul>

      <H2>How we share your information</H2>
      <p>
        We share data only with service providers that make the app work, and only as needed to
        provide it:
      </p>
      <ul>
        <li>
          <strong>Plaid</strong> — secure bank connectivity. See Plaid&rsquo;s{' '}
          <a href="https://plaid.com/legal/#end-user-privacy-policy">End User Privacy Policy</a>.
        </li>
        <li>
          <strong>Supabase</strong> — authentication and encrypted database hosting.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting.
        </li>
        <li>
          <strong>Apple</strong> — delivery of push notifications (APNs).
        </li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and we do not share it with
        advertisers or data brokers. We may disclose information if required by law.
      </p>

      <H2>How we protect your information</H2>
      <p>
        All data is encrypted in transit (HTTPS/TLS). Sensitive credentials such as your Plaid access
        token are encrypted at rest (AES-256-GCM), are never exposed to the app, and are never logged.
        Access to your data is restricted per user at the database level.
      </p>

      <H2>Data retention and deletion</H2>
      <p>
        We keep your information while your account is active. You can delete your account at any time
        from <strong>Settings → Delete account</strong> in the app, which permanently removes your
        profile, linked banks, transactions, and runway data. You can also disconnect an individual
        bank from the Accounts screen at any time. To request deletion another way, contact us at the
        address below.
      </p>

      <H2>Your rights</H2>
      <p>
        You can access, correct, or delete your information using the in-app controls, or by
        contacting us. Depending on where you live (for example, California or the EEA/UK), you may
        have additional rights over your personal data; we honor those requests where applicable.
      </p>

      <H2>Children</H2>
      <p>
        Nudget is not directed to children under 13, and we do not knowingly collect personal
        information from them.
      </p>

      <H2>Changes to this policy</H2>
      <p>
        We may update this policy from time to time. We&rsquo;ll revise the &ldquo;Last updated&rdquo;
        date above and, for material changes, provide additional notice.
      </p>

      <H2>Contact</H2>
      <p>
        Questions about this policy or your data? Email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p style={{ color: '#999', fontSize: 13, marginTop: '2.5rem' }}>
        Nudget is a personal-finance awareness tool, not financial advice.
      </p>
    </main>
  );
}
