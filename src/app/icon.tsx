import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #0d1b2a, #11263a)",
          borderRadius: 16,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: 12,
            border: "2px solid rgba(148, 210, 189, 0.28)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            height: 34,
          }}
        >
          <div
            style={{
              width: 8,
              height: 16,
              borderRadius: 999,
              background: "#4dc8b0",
            }}
          />
          <div
            style={{
              width: 8,
              height: 24,
              borderRadius: 999,
              background: "#75d1f0",
            }}
          />
          <div
            style={{
              width: 8,
              height: 30,
              borderRadius: 999,
              background: "#f3b562",
            }}
          />
          <div
            style={{
              width: 8,
              height: 22,
              borderRadius: 999,
              background: "#4dc8b0",
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
