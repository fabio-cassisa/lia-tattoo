import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#faf6ef",
          fontFamily: "'Playfair Display', Georgia, serif",
          color: "#1a1a1a",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        {/* Star ornament */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 12 12"
          style={{ marginBottom: 24, opacity: 0.3 }}
        >
          <path
            d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z"
            fill="#a02020"
          />
        </svg>

        <h1
          style={{
            fontSize: "clamp(3rem, 10vw, 6rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            margin: 0,
          }}
        >
          404
        </h1>

        <p
          style={{
            fontSize: 14,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#5a5a5a",
            margin: "16px 0 32px",
          }}
        >
          Page not found
        </p>

        <div
          style={{
            width: 48,
            height: 1,
            backgroundColor: "rgba(26, 26, 26, 0.15)",
            marginBottom: 32,
          }}
        />

        <p
          style={{
            fontSize: 15,
            color: "#5a5a5a",
            maxWidth: 400,
            lineHeight: 1.6,
            margin: "0 0 32px",
          }}
        >
          This page wandered off. Maybe it&apos;s getting a tattoo somewhere.
        </p>

        <Link
          href="/en"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            backgroundColor: "#a02020",
            color: "#faf6ef",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Back to home
        </Link>

        <p
          style={{
            marginTop: 48,
            fontSize: 12,
            color: "#7a7a7a",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          &#10043; liagiorgi.one.ttt &#10043;
        </p>
      </body>
    </html>
  );
}
