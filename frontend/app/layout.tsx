import type { Metadata } from "next";
import { fonts } from "@/app/designSystem";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mimesis",
  description: "Mimesis application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fonts.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
