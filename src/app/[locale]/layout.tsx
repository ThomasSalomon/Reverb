import type { Metadata } from "next";
import { JetBrains_Mono, Rajdhani } from "next/font/google";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import BottomNav from "@/components/BottomNav/BottomNav";
import ToastListener from "@/components/Toast/ToastListener";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "../globals.css";

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-mono" 
});

const rajdhani = Rajdhani({ 
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: "--font-display" 
});

const siteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Ride The Music (RTM) | Califica, Reseña y Descubre Música",
  description: "Una plataforma premium para amantes de la música. Califica álbumes, escribe reseñas y comparte tu pasión musical.",
  openGraph: {
    title: "Ride The Music (RTM) | Califica, Reseña y Descubre Música",
    description: "Una plataforma premium para amantes de la música. Califica álbumes, escribe reseñas y comparte tu pasión musical.",
    url: siteUrl,
    siteName: "Ride The Music",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Ride The Music - Plataforma de música",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ride The Music (RTM) | Califica, Reseña y Descubre Música",
    description: "Una plataforma premium para amantes de la música. Califica álbumes, escribe reseñas y comparte tu pasión musical.",
    images: ["/logo.png"],
  },
};

export default async function RootLayout({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  // Fetch messages (dictionaries) for the client components
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${jetbrainsMono.variable} ${rajdhani.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          {children}
          <Footer />
          <BottomNav />
          <ToastListener />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
