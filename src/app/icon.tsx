import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const ACCENT = "#9d8cff";
const INK = "#0f0f0f";

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
          borderRadius: 18,
          background: ACCENT,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 32,
            borderRadius: 10,
            background: INK,
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              marginLeft: 4,
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
              borderLeft: `14px solid ${ACCENT}`,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
