import { useEffect, useRef, useState, type ReactNode } from "react";
export default function ActionMenu({ children, className, label = "Ações" }: { children: ReactNode; className?: string; label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const clickAway = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setIsOpen(false); };
    document.addEventListener("pointerdown", clickAway);
    return () => document.removeEventListener("pointerdown", clickAway);
  }, [isOpen]);
  return <details ref={menu} className={className} open={isOpen} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setIsOpen(false); menu.current?.querySelector("summary")?.focus(); } }}>
    <summary aria-label={label} aria-expanded={isOpen} title={label} onClick={(event) => { event.preventDefault(); setIsOpen(!isOpen); }}>•••</summary>
    <div onClick={(event) => { if ((event.target as HTMLElement).closest("button:not(:disabled), a")) setIsOpen(false); }}>{children}</div>
  </details>;
}
