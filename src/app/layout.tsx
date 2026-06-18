import type { Metadata } from "next";
import { Fredoka, Patrick_Hand } from "next/font/google";
import "./globals.css";

const patrickHand = Patrick_Hand({
  weight: "400",
  variable: "--font-heading",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "skribbl.ai - Play Scribble with Local AI",
  description: "Draw anything on the canvas and play real-time guessing games with a local vision AI model.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${patrickHand.variable} ${fredoka.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        {children}
        
        {/* SVG Filters for Crayon Hand-Drawn Wobble Effect */}
        <svg xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
          <defs>
            <filter id="crayon-wobble">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      </body>
    </html>
  );
}
