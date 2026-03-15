import type { Metadata } from "next";
import { fonts } from "@/app/designSystem";
import { MimesisThemeProvider } from "@/contexts/MimesisThemeContext";
import { AgentStateProvider } from "@/contexts/AgentStateContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mimesis",
  description: "Mimesis — AI-Powered Creative Production Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fonts.className} antialiased`}>
        <AgentStateProvider>
          <MimesisThemeProvider>
            {children}
          </MimesisThemeProvider>
        </AgentStateProvider>
      </body>
    </html>
  );
}
