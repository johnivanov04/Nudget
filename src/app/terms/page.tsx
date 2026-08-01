/**
 * Terms of Service — served at /terms for a stable public URL (App Store /
 * TestFlight require it) and linked from the app's Settings → About.
 *
 * Written to match what Nudget actually is: a personal-finance *awareness* tool
 * that shows estimates. It explicitly does NOT promise to prevent overdrafts or
 * guarantee outcomes (a spec + compliance requirement). Not legal advice —
 * review for your jurisdiction before a public App Store submission.
 */
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Nudget — Terms of Service',
  description: 'The terms for using Nudget.',
};

const CONTACT_EMAIL = 'ivanov.john04@gmail.com';
const LAST_UPDATED = 'July 31, 2026';

function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 20, marginTop: '2rem', marginBottom: '0.5rem' }}>{children}</h2>;
}

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', color: '#111' }}>
      <h1 style={{ marginBottom: 0 }}>Terms of Service</h1>
      <p style={{ color: '#777', marginTop: 4 }}>Last updated: {LAST_UPDATED}</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Nudget (the &ldquo;Service&rdquo;).
        By creating an account or using the Service, you agree to these Terms. If you do not agree,
        please do not use Nudget.
      </p>

      <H2>1. What Nudget is</H2>
      <p>
        Nudget is a personal-finance <strong>awareness</strong> tool. It reads your bank balances and
        recent transactions (via Plaid) to estimate how much is <em>safe to spend before your next
        payday</em>, surface upcoming bills, and send optional reminders. Nudget is{' '}
        <strong>not</strong> a bank, a budgeting service, an investment or tax advisor, or a
        money-movement service.
      </p>

      <H2>2. Estimates, not advice or guarantees</H2>
      <ul>
        <li>
          All numbers Nudget shows are <strong>estimates for awareness</strong>, based on data from
          your financial institution via Plaid. They are <strong>not financial, investment, tax, or
          legal advice</strong>.
        </li>
        <li>
          Bank data can be delayed, incomplete, or inaccurate, and predictions (like recurring bills)
          can be wrong. Nudget does <strong>not guarantee</strong> that it will prevent an overdraft,
          a late fee, or any other outcome.
        </li>
        <li>
          You are responsible for your own financial decisions. Always verify important figures with
          your bank before acting on them.
        </li>
      </ul>

      <H2>3. Eligibility &amp; your account</H2>
      <ul>
        <li>You must be at least 18 years old and able to form a binding contract to use Nudget.</li>
        <li>
          You are responsible for keeping your login secure and for activity under your account.
        </li>
        <li>You agree to provide accurate information (such as your pay schedule) when asked.</li>
      </ul>

      <H2>4. Connecting your bank</H2>
      <p>
        Bank connections are provided through Plaid. You authenticate directly with your bank —{' '}
        <strong>Nudget never sees or stores your bank login credentials.</strong> Your use of Plaid is
        also subject to Plaid&rsquo;s{' '}
        <a href="https://plaid.com/legal/#end-user-privacy-policy">end-user policy</a>. You can
        disconnect a bank at any time from the Accounts screen.
      </p>

      <H2>5. Acceptable use</H2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service unlawfully, or to access data that isn&rsquo;t yours;</li>
        <li>Interfere with, disrupt, or attempt to break the security of the Service;</li>
        <li>Reverse engineer or misuse the Service or its data beyond your own personal use.</li>
      </ul>

      <H2>6. Privacy</H2>
      <p>
        Your use of Nudget is also governed by our{' '}
        <a href="/privacy">Privacy Policy</a>, which explains what we collect and how we protect it.
      </p>

      <H2>7. Fees</H2>
      <p>
        Nudget is currently offered free of charge during its beta. If paid features are introduced in
        the future, the applicable pricing and terms will be presented to you before you are charged.
      </p>

      <H2>8. Cancellation &amp; deletion</H2>
      <p>
        You can stop using Nudget at any time and delete your account and all associated data from{' '}
        <strong>Settings → Delete account</strong> in the app. Deletion is permanent.
      </p>

      <H2>9. Third-party services</H2>
      <p>
        Nudget relies on third parties (including Plaid, Supabase, Vercel, and Apple) to operate. We
        are not responsible for the availability or actions of these providers, though we choose them
        for their security and reliability.
      </p>

      <H2>10. Disclaimers</H2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong>{' '}
        without warranties of any kind, express or implied, including accuracy, fitness for a
        particular purpose, or uninterrupted availability, to the fullest extent permitted by law.
      </p>

      <H2>11. Limitation of liability</H2>
      <p>
        To the fullest extent permitted by law, Nudget and its operator will not be liable for any
        indirect, incidental, or consequential damages, or for any financial loss (such as overdraft
        or late fees), arising from your use of — or inability to use — the Service or from reliance
        on its estimates.
      </p>

      <H2>12. Changes to these Terms</H2>
      <p>
        We may update these Terms from time to time. We&rsquo;ll revise the &ldquo;Last updated&rdquo;
        date above and, for material changes, provide additional notice. Continued use after a change
        means you accept the updated Terms.
      </p>

      <H2>13. Contact</H2>
      <p>
        Questions about these Terms? Email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p style={{ color: '#999', fontSize: 13, marginTop: '2.5rem' }}>
        Nudget provides estimates for awareness, not financial advice.
      </p>
    </main>
  );
}
