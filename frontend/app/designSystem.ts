import localFont from "next/font/local";
import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * Design System — Font & Typography Configuration
 *
 * Centralised font definitions for the Mimesis application.
 * Google Sans is loaded locally from public/fonts/.
 * Inter and JetBrains Mono are loaded via next/font/google.
 *
 * Usage:
 *   import { fonts, typography } from "@/app/designSystem";
 *
 *   // Apply CSS variable classes to the root element
 *   <body className={fonts.className}>
 *
 *   // Use typography tokens on elements
 *   <h1 style={typography.h1}>Hello</h1>
 */

// ─── Font Definitions ──────────────────────────────────────────────────────

export const fontGoogleSans = localFont({
    src: [
        {
            path: "../public/fonts/GoogleSans.ttf",
            style: "normal",
        },
        {
            path: "../public/fonts/GoogleSans-Italic.ttf",
            style: "italic",
        },
    ],
    variable: "--font-google-sans",
    display: "swap",
});

export const fontMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
    display: "swap",
});

// ─── Combined Font Helper ──────────────────────────────────────────────────

export const fonts = {
    /** Space-separated CSS variable class names — apply to <body> */
    className: [fontGoogleSans.variable, fontMono.variable].join(
        " "
    ),

    vars: {
        googleSans: "--font-google-sans",
        inter: "--font-google-sans",
        mono: "--font-mono",
    },
} as const;

// ─── Typography Tokens ─────────────────────────────────────────────────────

export const typography = {
    // Title Welcome Page
    welcomeTitle: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "78px",
        fontWeight: 500,
        color: "#ffffffff",
        letterSpacing: "-2.4px",
        lineHeight: "48px",
    },

    // Titres principaux (Hero)
    h1: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "40px",
        fontWeight: 500,
        color: "#ffffffff",
        letterSpacing: "-2.4px",
        lineHeight: "48px",
    },
    h1Mobile: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "32px",
        fontWeight: 600,
        color: "#ffffffff",
        letterSpacing: "-1.92px",
        lineHeight: "40px",
    },
    // Titres de sections
    h2: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "22px",
        fontWeight: 600,
        color: "#ffffffff",
        letterSpacing: "-1px",
        lineHeight: "32px",
    },
    // Sous-titres
    h3: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "18px",
        fontWeight: 600,
        color: "#ffffffff",
        letterSpacing: "-0.5px",
        lineHeight: "28px",
    },
    // Corps de texte - Large (pour les intros, descriptions importantes)
    bodyLarge: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "18px",
        fontWeight: 500,
        color: "#ffffffff",
        letterSpacing: "0px",
        lineHeight: "32px",
    },
    // Corps de texte - Medium (texte standard)
    bodyMedium: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "14px",
        fontWeight: 400,
        color: "#ffffffff",
        letterSpacing: "-0.2px",
        lineHeight: "1.5",
    },
    // Corps de texte - Small (labels, metadata)
    bodySmall: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "12px",
        fontWeight: 400,
        color: "#ffffffff",
        letterSpacing: "0px",
        lineHeight: "1.4",
    },
    // Texte très petit (captions, hints)
    caption: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "12px",
        fontWeight: 500,
        color: "#ffffffff",
        letterSpacing: "-0.1px",
        lineHeight: "1.3",
    },
    // Labels et badges
    label: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "14px",
        fontWeight: 500,
        color: "#ffffffff",
        letterSpacing: "0.5px",
    },
    labelSmall: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "12px",
        fontWeight: 500,
        color: "#ffffffff",
        letterSpacing: "0.5px",
    },
    // Boutons
    button: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "16px",
        fontWeight: 500,
        letterSpacing: "0px",
    },
    buttonSmall: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: "0px",
    },
    buttonLarge: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "20px",
        fontWeight: 400,
        letterSpacing: "-1px",
    },
    buttonLargeItalic: {
        fontFamily: "var(--font-google-sans)",
        fontSize: "20px",
        fontWeight: 500,
        letterSpacing: "-1px",
        fontStyle: "italic",
    },
} as const;

export const colors = {

    background: {
        primary: "#0E0E0E",
        secondary: "#ffffff",
    },
    text: {
        primary: "#ffffff",
        secondary: "#4C4C4C",
    }
} as const;