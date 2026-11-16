import { useRef, useState } from "react"
import { toPng } from "html-to-image"
import { ShareCardView } from "@/components/ShareCardView"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { t, type Lang } from "@/i18n"
import type { ShareCardModel } from "@/lib/shareCard"

export function ShareDialog({
  lang,
  open,
  onOpenChange,
  model,
  csv,
  filename,
  shareHash,
}: {
  lang: Lang
  open: boolean
  onOpenChange: (open: boolean) => void
  model: ShareCardModel
  csv: string
  filename: string
  shareHash: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${shareHash}`
    window.history.replaceState(null, "", `#${shareHash}`)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setCopyFailed(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setCopyFailed(true)
    }
  }

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function downloadImage() {
    const node = cardRef.current
    if (!node) return
    try {
      await document.fonts.ready
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#f4efe4" })
      const anchor = document.createElement("a")
      anchor.href = dataUrl
      anchor.download = filename.replace(/\.csv$/, ".png")
      anchor.click()
      setImageFailed(false)
    } catch {
      setImageFailed(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t(lang, "shareTitle")}</DialogTitle>
          <DialogDescription>{t(lang, "shareHint")}</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <ShareCardView model={model} cardRef={cardRef} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void copyLink()}>
            {copied ? t(lang, "shareCopied") : t(lang, "shareCopy")}
          </Button>
          <Button type="button" variant="outline" onClick={downloadCsv}>
            {t(lang, "shareCsv")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadImage()}>
            {t(lang, "shareImage")}
          </Button>
        </div>
        {copyFailed && <p className="text-sm text-muted-foreground">{t(lang, "shareCopyFailed")}</p>}
        {imageFailed && (
          <p className="text-sm text-muted-foreground">{t(lang, "shareImageFailed")}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
