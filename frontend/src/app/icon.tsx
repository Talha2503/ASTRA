import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050A18",
          borderRadius: 14,
        }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="16" cy="16" r="5.5" fill="#3FA9F5" />
          <ellipse
            cx="16"
            cy="16"
            rx="13"
            ry="5.5"
            transform="rotate(-24 16 16)"
            stroke="#5EE1E6"
            strokeWidth="2"
          />
          <circle cx="23.66" cy="8.72" r="2.6" fill="#F2A65A" />
        </svg>
      </div>
    ),
    { ...size },
  );
}