/**
 * Plaid OAuth redirect target. When a bank finishes its OAuth flow it redirects
 * here; on iOS this is a universal link, so the Nudget app opens and LinkKit
 * resumes automatically. This page is only shown as a fallback (e.g. the app
 * isn't installed, or the link is opened in a browser).
 */
export const metadata = {
  title: 'Nudget — Returning…',
};

export default function PlaidOAuthPage() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center', color: '#111' }}>
      <h1>Returning to Nudget…</h1>
      <p style={{ color: '#555' }}>
        If Nudget doesn&rsquo;t reopen automatically, switch back to the app to finish connecting your
        bank.
      </p>
    </main>
  );
}
