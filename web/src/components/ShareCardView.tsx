import type { Ref } from "react"
import type { ShareCardModel } from "@/lib/shareCard"

const ink = "#3a2e24"
const muted = "#6d5c4e"
const paper = "#f4efe4"
const card = "#fffaf3"
const line = "#e4d8c6"

export function ShareCardView({
  model,
  cardRef,
}: {
  model: ShareCardModel
  cardRef?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={cardRef}
      style={{
        width: 720,
        background: paper,
        color: ink,
        fontFamily: '"Sora", "PingFang SC", "Noto Sans SC", sans-serif',
        padding: 28,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#8a5a3c",
        }}
      >
        {model.kicker}
      </p>
      <h2
        style={{
          margin: "10px 0 0",
          fontFamily: '"Fraunces", "Songti SC", "Noto Serif SC", serif',
          fontSize: 36,
          lineHeight: 1.05,
          fontWeight: 500,
        }}
      >
        {model.title}
      </h2>
      <p style={{ margin: "8px 0 0", color: muted }}>{model.subtitle}</p>
      {model.note && <p style={{ margin: "8px 0 0", fontSize: 12, color: muted }}>{model.note}</p>}
      {model.lines.length > 0 && (
        <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none" }}>
          {model.lines.map((entry, index) => (
            <li
              key={`${entry.label}-${index}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "4px 0",
                fontSize: 14,
              }}
            >
              <span>{entry.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{entry.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {model.more && <p style={{ margin: "8px 0 0", fontSize: 12, color: muted }}>{model.more}</p>}
      {model.blocked && <p style={{ margin: "16px 0 0", fontSize: 14 }}>{model.blocked}</p>}
      {model.empty && <p style={{ margin: "16px 0 0", fontSize: 14 }}>{model.empty}</p>}
      {model.cities.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {model.cities.map((city) => (
            <div
              key={city.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                background: card,
                border: `1px solid ${line}`,
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <span style={{ fontWeight: 600 }}>{city.name}</span>
              {city.reason ? (
                <span style={{ color: muted, fontSize: 13, textAlign: "right" }}>{city.reason}</span>
              ) : (
                <span style={{ textAlign: "right" }}>
                  <span style={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
                    {city.primary}
                  </span>
                  <span style={{ display: "block", color: muted, fontSize: 12 }}>{city.secondary}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p style={{ margin: "20px 0 0", fontSize: 12, color: muted }}>
        {model.footerSource} · {model.footerSite}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: muted }}>{model.footerNote}</p>
    </div>
  )
}
