import "./page.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "DocRAG Studio",
    description: "Advanced RAG with Document Upload",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
