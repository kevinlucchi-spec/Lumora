"use client"

import { useState, useRef, useEffect } from "react"

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

export function CustomSelect({ value, onChange, options, placeholder = "Select...", className = "" }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-left focus:outline-none focus:border-indigo-500 transition-colors flex items-center justify-between">
        <span className={selected ? "text-white" : "text-white/30"}>{selected?.label ?? placeholder}</span>
        <span className="text-white/30 ml-2">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {placeholder && (
            <button type="button" onClick={() => { onChange(""); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${!value ? "text-white bg-white/10" : "text-white/40 hover:bg-white/5 hover:text-white/60"}`}>
              {placeholder}
            </button>
          )}
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${o.value === value ? "text-white bg-indigo-600/20" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
