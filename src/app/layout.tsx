import type { ReactNode } from 'react';

export const metadata = {
  title: 'Nudget API',
  description: 'Paycheck runway backend — "Am I safe to spend before payday?"',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: '2rem',
          lineHeight: 1.5,
          color: '#111',
        }}
      >
        {children}
      </body>
    </html>
  );
}
