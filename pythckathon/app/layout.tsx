import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import { MenuProvider } from "@/Components/providers/MenuProvider";
import WalletProvider from "@/Components/providers/WalletProvider";
import { ThemeProvider } from "@/Components/providers/ThemeProvider";
import Navbar from "@/Components/static/Navbar/Navbar";
import Footer from "@/Components/static/Footer/Footer";
import MobileMenu from "@/Components/layout/MobileMenu";
import { Toaster } from "sonner";
import { CurrencyProvider } from "@/lib/currency-context";
import MobileBottomNav from "@/Components/shared/MobileBottomNav";
import ClientShell from "@/Components/providers/ClientShell";
import AIChatbot from "@/Components/shared/AIChatbot";
import DegenStrip from "@/Components/shared/DegenStrip";
import DegenToolbar from "@/Components/shared/DegenToolbar";
import TxTracker from "@/Components/shared/TxTracker";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pythfeeds.com"),
  title: "PythFeeds — Real-Time Crypto, Stocks, Metals & Forex Prices",
  description:
    "Real-time prices for crypto, stocks, metals, commodities and forex powered by Pyth Network oracle data. Track Bitcoin, Ethereum, Gold, Oil and more.",
  icons: {
    icon: "/dark-mode-pythfeeds.png",
    apple: "/dark-mode-pythfeeds.png",
  },
  openGraph: {
    title: "PythFeeds — Real-Time Crypto, Stocks, Metals & Forex Prices",
    description:
      "Real-time prices for crypto, stocks, metals, commodities and forex powered by Pyth Network oracle data.",
    images: [
      {
        url: "/dark-mode-pythfeeds.png",
        width: 1200,
        height: 630,
        alt: "PythFeeds",
      },
    ],
    type: "website",
    siteName: "PythFeeds",
  },
  twitter: {
    card: "summary_large_image",
    title: "PythFeeds — Real-Time Crypto, Stocks, Metals & Forex Prices",
    description:
      "Real-time prices for crypto, stocks, metals, commodities and forex powered by Pyth Network oracle data.",
    images: ["/dark-mode-pythfeeds.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('pythfeeds_mode')!=='standard'){document.documentElement.classList.add('degen')}}catch(e){}` }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A0B0D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${syne.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
        <WalletProvider>
          <CurrencyProvider>
          <MenuProvider>
            <DegenStrip />
            <ClientShell>
              <Navbar />
              <DegenToolbar />
              <main>{children}</main>
              <Footer />
              <MobileMenu />
              <MobileBottomNav />
              <AIChatbot />
              <TxTracker />
              <Toaster richColors position="top-right" />
            </ClientShell>
          </MenuProvider>
          </CurrencyProvider>
        </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
