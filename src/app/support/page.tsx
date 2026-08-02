/**
 * Support page — served at /support so it has a stable public URL for the App
 * Store "Support URL" field (Apple requires a working page with a way to get
 * help). Kept simple and accurate; contact email matches the privacy page.
 */
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Nudget — Support',
  description: 'Help and contact for Nudget: Safe to Spend.',
};

const CONTACT_EMAIL = 'ivanov.john04@gmail.com';

function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 20, marginTop: '2rem', marginBottom: '0.5rem' }}>{children}</h2>;
}

export default function SupportPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', color: '#111' }}>
      <h1 style={{ marginBottom: 0 }}>Support</h1>
      <p style={{ color: '#777', marginTop: 4 }}>Nudget: Safe to Spend</p>

      <p>
        Nudget answers one question — <em>&ldquo;Am I safe to spend before payday?&rdquo;</em> — by
        showing your safe-to-spend amount after upcoming bills. Need a hand? We&rsquo;re happy to
        help.
      </p>

      <H2>Contact us</H2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we&rsquo;ll get back to you.
        Please include what happened and, if it helps, a screenshot — but never share your bank login
        or passwords.
      </p>

      <H2>Common questions</H2>
      <ul>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>How do I connect my bank?</strong> During setup, tap Connect Bank and sign in
          through Plaid. You authenticate directly with your bank — Nudget never sees or stores your
          bank login.
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>Why is my safe-to-spend different from my bank balance?</strong> Your balance
          includes money already promised to upcoming bills. Nudget subtracts those (and your safety
          buffer) so you see what&rsquo;s actually safe to spend before payday. These are estimates to
          help you plan, not financial advice or a guarantee against overdrafts.
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>How do I add or fix a bill?</strong> Open the Bills screen to confirm detected
          bills, edit an amount or date, or add a bill Nudget can&rsquo;t see (like rent paid by
          check).
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>How do I manage or cancel my subscription?</strong> Subscriptions are billed through
          your Apple ID. Manage or cancel anytime in the App Store app: tap your profile →
          Subscriptions → Nudget. A 7-day free trial is included for new subscribers; cancel before it
          ends to avoid being charged.
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>How do I disconnect a bank?</strong> Open Accounts → Linked banks and remove the
          bank. We ask Plaid to revoke access and delete the connection.
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>How do I delete my account and data?</strong> Open Settings → Delete Account. This
          permanently removes your account and associated data.
        </li>
      </ul>

      <H2>Privacy &amp; terms</H2>
      <p>
        See our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Use</a>. We
        don&rsquo;t sell your data or use it for advertising.
      </p>
    </main>
  );
}
