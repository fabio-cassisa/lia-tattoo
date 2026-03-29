import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "liagiorgi.one.ttt — Traditional Tattoo Artist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#faf6ef",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* Border frame */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: "1px solid rgba(26, 26, 26, 0.1)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 32,
            right: 32,
            bottom: 32,
            border: "1px solid rgba(26, 26, 26, 0.06)",
            display: "flex",
          }}
        />

        {/* Star ornament top */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 60,
              height: 1,
              backgroundColor: "rgba(26, 26, 26, 0.2)",
            }}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 12 12"
          >
            <path
              d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z"
              fill="#a02020"
            />
          </svg>
          <div
            style={{
              width: 60,
              height: 1,
              backgroundColor: "rgba(26, 26, 26, 0.2)",
            }}
          />
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#1a1a1a",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          liagiorgi.one.ttt
        </div>

        {/* Descriptor */}
        <div
          style={{
            fontSize: 18,
            color: "#5a5a5a",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            marginTop: 20,
          }}
        >
          &#10043; Traditional Tattoo Artist &#10043;
        </div>

        {/* Location line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 40,
          }}
        >
          <div
            style={{
              width: 40,
              height: 1,
              backgroundColor: "rgba(26, 26, 26, 0.15)",
            }}
          />
          <div
            style={{
              fontSize: 14,
              color: "#7a7a7a",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Malmö &middot; Copenhagen
          </div>
          <div
            style={{
              width: 40,
              height: 1,
              backgroundColor: "rgba(26, 26, 26, 0.15)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
