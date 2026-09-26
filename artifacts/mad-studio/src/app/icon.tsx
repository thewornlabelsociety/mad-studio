import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

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
          background: "#FFFFFF",
          border: "2px solid #000000",
          position: "relative",
          fontFamily: "monospace",
          fontWeight: 700,
          fontSize: 18,
          color: "#000000",
        }}
      >
        M
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 6,
            height: 6,
            background: "#FF3B00",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
