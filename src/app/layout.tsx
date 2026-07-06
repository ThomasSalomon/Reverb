import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/Navbar/Navbar";
import ToastListener from "@/components/Toast/ToastListener";
import "./globals.css";

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
        url: "/logo.png", // Recommended: replace with a 1200x630 image (e.g. /og-image.png) for best results
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${plusJakartaSans.variable}`}>
        <Navbar />
        {children}
        <ToastListener />
      </body>
    </html>
  );
}
