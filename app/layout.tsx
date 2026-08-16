import type { Metadata } from "next";
import { Poppins, Syne } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kozapp — Vendeur IA pour WhatsApp Business",
  description: "Kozapp transforme votre WhatsApp Business en canal de vente automatisé grâce à l'IA. Réponses instantanées, catalogue, commandes et relances gérées par l'IA.",
  themeColor: "#ffffff",
  icons: {
    icon: "/kozapp-icon-square.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${poppins.variable} ${syne.variable}`}>
      <body>{children}</body>
    </html>
  );
}
