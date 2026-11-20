import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

/**
 * Number field that keeps the raw text while it has focus, so a value can be
 * cleared and replaced without an effective default snapping back mid-edit.
 * Empty input reports `undefined`; invalid or non-positive text is kept while
 * editing but not reported, and the value re-syncs when it changes from
 * elsewhere while the field is not focused.
 */
export function NumberField({
  value,
  label,
  placeholder,
  className,
  onValue,
}: {
  value: number | undefined
  label: string
  placeholder?: string
  className?: string
  onValue: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (focused.current) return
    setText(value === undefined ? "" : String(value))
  }, [value])

  return (
    <Input
      className={className}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={label}
      value={text}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        setText(value === undefined ? "" : String(value))
      }}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        if (next.trim() === "") {
          onValue(undefined)
          return
        }
        const parsed = Number(next)
        if (Number.isFinite(parsed) && parsed > 0) onValue(parsed)
      }}
    />
  )
}
