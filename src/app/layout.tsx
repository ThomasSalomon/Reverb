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

export const metadata: Metadata = {
  title: "Reverb | Califica, Reseña y Descubre Música",
  description: "Una plataforma premium para amantes de la música. Califica álbumes, escribe reseñas y comparte tu pasión musical.",
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
