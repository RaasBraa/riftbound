import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Riftbound Business Platform',
  description: 'Local inventory and deal finder for Riftbound singles resale',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
