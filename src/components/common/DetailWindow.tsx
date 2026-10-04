import { useEffect, useId, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import "./detailWindow.css";

type Props = { entityId: string | number; context: string; title: string; onClose: () => void; children: ReactNode; inline?: boolean };

export default function DetailWindow({ entityId, context, title, onClose, children, inline = false }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (inline) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [inline]);
  useEffect(() => {
    const resize = () => setPosition({ x: 0, y: 0 });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  function startDrag(event: PointerEvent<HTMLElement>) {
    if (maximized || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const rect = panel.current!.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLElement>) {
    if (!drag.current || !panel.current) return;
    const rect = panel.current.getBoundingClientRect();
    const left = Math.max(0, Math.min(window.innerWidth - rect.width, drag.current.left + event.clientX - drag.current.x));
    const top = Math.max(0, Math.min(window.innerHeight - rect.height, drag.current.top + event.clientY - drag.current.y));
    setPosition({ x: left - (window.innerWidth - rect.width) / 2, y: top - (window.innerHeight - rect.height) / 2 });
  }
  if (inline) return <>{children}</>;
  return createPortal(<>
    <section ref={panel} tabIndex={-1} role="dialog" aria-labelledby={titleId} data-entity-id={entityId} data-context={context}
      hidden={minimized} className={`detail-window${maximized ? " is-maximized" : ""}`}
      style={maximized ? undefined : { transform: `translate(${position.x}px, ${position.y}px)` }}
      onKeyDown={(event) => { if (event.key === "Escape" && event.target === event.currentTarget) onClose(); }}>
      <header className="detail-window-titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest("button")) setMaximized(!maximized); }}>
        <h2 id={titleId}>{title}</h2><div className="detail-window-controls">
          <button type="button" aria-label="Minimizar" title="Minimizar" onClick={() => setMinimized(true)}>−</button>
          <button type="button" aria-label={maximized ? "Restaurar tamanho" : "Maximizar"} title={maximized ? "Restaurar tamanho" : "Maximizar"} onClick={() => setMaximized(!maximized)}>{maximized ? "❐" : "□"}</button>
          <button type="button" aria-label="Fechar janela" title="Fechar" onClick={onClose}>×</button>
        </div>
      </header><div className="detail-window-content">{children}</div>
    </section>
    {minimized ? <div className="detail-window-dock"><button type="button" onClick={() => { setMinimized(false); requestAnimationFrame(() => panel.current?.focus()); }} aria-label={`Restaurar ${title}`}>□ {title}</button><button type="button" aria-label="Fechar janela" onClick={onClose}>×</button></div> : null}
  </>, document.body);
}
