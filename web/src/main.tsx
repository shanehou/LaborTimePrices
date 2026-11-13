import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import { initialLang } from "./lib/storage"
import "./index.css"

const startupLang = initialLang()
document.documentElement.lang = startupLang === "zh" ? "zh-Hans" : "en"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App startupLang={startupLang} />
  </StrictMode>,
)
