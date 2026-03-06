import Image from "next/image";
import { typography, colors } from "./designSystem";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-zinc-50 dark:bg-black gap-2">
      <h1 style={typography.welcomeTitle}>Mimesis</h1>

      <p style={{ ...typography.bodyLarge, color: colors.text.secondary }}>
        Production Studio
      </p>

      <button
        style={{
          ...typography.buttonLarge,
          width: "250px",
          height: "70px",
          position: "fixed",
          bottom: "40px",
          borderColor: colors.text.primary,
          color: colors.text.primary,
          borderRadius: "100px",
          border: "2px solid",
          cursor: "pointer",
        }}
      >
        Say
        <span> </span>
        <span style={typography.buttonLargeItalic}>
          &quot;Mimesis let&apos;s start&quot;
        </span>
      </button>
    </div>

  );
}
