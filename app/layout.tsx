import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ascala',
  description: 'Ascala intake workspace',
  icons: {
    icon: '/icon.png',
  },
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
