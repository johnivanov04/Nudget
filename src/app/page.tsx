/**
 * Minimal status page. The product surface is the iOS app + widget (later
 * phases); this backend is API-first. This page just confirms the server is up
 * and points at the demo endpoint.
 */
export default function HomePage() {
  return (
    <main style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: 0 }}>Nudget</h1>
      <p style={{ color: '#555', marginTop: 4 }}>
        Paycheck runway backend — <em>&ldquo;Am I safe to spend before payday?&rdquo;</em>
      </p>
      <p>
        <strong>Phase 1: Backend foundation.</strong> API-first; the iOS app and WidgetKit surfaces
        come in later phases.
      </p>
      <p>Try the runway engine with the bundled seed data:</p>
      <pre
        style={{
          background: '#f5f5f5',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          overflowX: 'auto',
        }}
      >
        GET /api/widget/snapshot?demo=1{'\n'}
        GET /api/widget/snapshot?demo=1&privacy=1{'\n'}
        POST /api/runway/recalculate?demo=1
      </pre>
      <p style={{ color: '#777', fontSize: 14 }}>See README.md and NEXT_STEPS.md for status.</p>
    </main>
  );
}
