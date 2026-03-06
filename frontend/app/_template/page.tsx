import { typography, colors } from "@/app/designSystem";

/**
 * Template Page
 *
 * Duplicate this file into any new route folder, e.g.:
 *   app/my-new-page/page.tsx
 *
 * It comes pre-configured with:
 *  - Full-screen black background (matching the home page)
 *  - Design system imports (typography & colors)
 *  - Centered flex layout
 */
export default function TemplatePage() {
    return (
        <div
            className="flex flex-col min-h-screen items-center justify-center bg-black"
            style={{ background: colors.background.primary }}
        >
            <h1 style={typography.h1}>New Page</h1>

            <p style={{ ...typography.bodyLarge, color: colors.text.secondary }}>
                Start building here
            </p>
        </div>
    );
}
