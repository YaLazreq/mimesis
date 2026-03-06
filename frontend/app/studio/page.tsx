import { typography, colors } from "@/app/designSystem";

export default function StudioPage() {
    return (
        <div
            className="flex flex-col min-h-screen items-center justify-center bg-black"
            style={{ background: colors.background.primary }}
        >
            <h1 style={typography.h1}>Studio</h1>

            <p style={{ ...typography.bodyLarge, color: colors.text.secondary }}>
                Start building here
            </p>
        </div>
    );
}