import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wira AI — Dashboard",
  description: "Ekosistem Bisnis SaaS berbasis AI Agent untuk UMKM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
