import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/Navbar/Navbar";
import ToastListener from "@/components/Toast/ToastListener";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "../globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter" 
});

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: "--font-plus-jakarta" 
});

const siteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Reverb | Califica, Reseña y Descubre Música",
  description: "Una plataforma premium para amantes de la música. Califica álbumes, escribe reseñas y comparte tu pasión musical.",
  openGraph: {
    title: "Reverb | Califica, Reseña y Descubre Música",
    description: "Una plataforma premium para amantes de la música. Califica álbumes, escribe reseñas y comparte tu pasión musical.",
    url: siteUrl,
    siteName: "Reverb",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Reverb - Plataforma de música",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reverb | Califica, Reseña y Descubre Música",
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
      <body className={`${inter.variable} ${plusJakartaSans.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          {children}
          <ToastListener />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
