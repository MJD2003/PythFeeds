export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ margin: 0, padding: 0, background: "#0d1117" }}>
        {children}
      </body>
    </html>
  );
}
