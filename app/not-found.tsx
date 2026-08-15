import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#faf7fd", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 64, color: "#7f57a6", margin: 0 }}>404</h1>
        <p style={{ color: "#70798a", fontSize: 14, margin: "8px 0 24px" }}>Cette page n&apos;existe pas.</p>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 24px", background: "#7f57a6", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
