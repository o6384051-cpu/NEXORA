import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "NEXORA AI — Intelligence into Action",
 description: "منصة ذكاء اصطناعي مستقلة للتفكير والبحث والتنفيذ.",
 applicationName: "NEXORA AI",
 manifest: "/manifest.webmanifest",
 appleWebApp: { capable: true, title: "NEXORA", statusBarStyle: "black-translucent" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
