import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

// One family across the site, as in the HouseMarket layout: Manrope for headings, body and numbers.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const title = 'hyderabad.properties: check any Hyderabad project before you buy';
const description =
  'Free, independent checks for Hyderabad homes. RERA status, building approvals, lake buffer zones and the true cost of buying, in one report.';

export const metadata: Metadata = {
  // Makes every canonical and share-image URL absolute (relative ones are ignored by search engines and WhatsApp).
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || 'https://hyderabad.properties'),
  title,
  description,
  openGraph: { title, description, type: 'website', siteName: 'hyderabad.properties', locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-screen bg-white text-[#212121] antialiased font-sans selection:bg-[#212121] selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
