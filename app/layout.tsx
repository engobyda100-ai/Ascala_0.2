import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Persona UX Reviewer',
  description: 'AI-powered UX review through generated user personas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
