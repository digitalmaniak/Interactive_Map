"use client";
// Quick add search: type a place, pick a suggestion, the camera flies there and the
// existing add stop form opens prefilled. Nothing is saved here; the form's own confirm
// button runs the existing pin create path.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { QUICK_ADD, debounce, geocode, makeRateGate, nextIndex, shouldSearch } from "../../lib/geocode/quickAdd";

export default function QuickAdd({ onPick, inTrip = false, dialog = false, onCancel, inline = false, placeholder, ariaLabel, clearOnPick = false, autoFocus = false, initialQuery = "", onTypeTrip, onBuildTrip }) {
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [sel, setSel] = useState(-1);
  const input = useRef(null);
  const ctl = useRef(null);
  const gate = useMemo(() => makeRateGate(QUICK_ADD.minGapMs), []);

  const runRef = useRef(null);
  useEffect(() => {
    const d = debounce(async (text) => {
    ctl.current?.abort();
    const ac = new AbortController();
    ctl.current = ac;
    setBusy(true); setError("");
    try {
      const { results: r } = await geocode(text, { signal: ac.signal, gate });
      if (ac.signal.aborted) return;
      setResults(r); setSel(r.length ? 0 : -1); setOpen(true);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setResults([]); setSel(-1); setOpen(true);
      setError("Search is unavailable right now. Try again in a moment.");
    } finally {
      if (ctl.current === ac) setBusy(false);
    }
    }, QUICK_ADD.debounceMs);
    runRef.current = d;
    return () => { d.cancel(); ctl.current?.abort(); };
  }, [gate]);

  // Dialog mode (Add entry): focus on open.
  useEffect(() => { if (dialog || autoFocus) input.current?.focus(); }, [dialog, autoFocus]);

  // '/' focuses the search from anywhere except while typing in a field.
  useEffect(() => {
    if (dialog || inline) return undefined;
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, inline]);

  // Search runs off the native input event (typing, paste, autofill, IME and the clear
  // button all fire it), debounced. React's onChange only mirrors the value.
  const handleText = useCallback((v) => {
    setQ(v);
    if (shouldSearch(v)) runRef.current?.(v);
    else { runRef.current?.cancel(); ctl.current?.abort(); setBusy(false); setResults([]); setSel(-1); setError(""); setOpen(false); }
  }, []);
  useEffect(() => {
    const el = input.current;
    if (!el) return undefined;
    const onInput = () => handleText(el.value);
    el.addEventListener("input", onInput);
    el.addEventListener("search", onInput);
    return () => { el.removeEventListener("input", onInput); el.removeEventListener("search", onInput); };
  }, [handleText]);
  const onChange = (e) => setQ(e.target.value);

  const pick = useCallback((r) => {
    if (!r) return;
    setOpen(false); setQ(clearOnPick ? "" : r.name); setResults([]); setSel(-1);
    input.current?.blur();
    onPick?.(r);
  }, [onPick, clearOnPick]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open && results.length) setOpen(true);
      setSel((i) => nextIndex(e.key, i, results.length));
    } else if (e.key === "Enter") {
      if (open && sel >= 0) { e.preventDefault(); pick(results[sel]); }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
      else if (dialog) { e.preventDefault(); e.stopPropagation(); onCancel?.(); }
      else input.current?.blur();
    }
  };

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const listId = `v2-quickadd-list-${uid}`;
  const showList = open && (results.length > 0 || error || (!busy && shouldSearch(q)));
  const box = (
    <div className={dialog ? "v2-quickadd v2-quickadd-dialog" : inline ? "v2-quickadd v2-quickadd-inline" : "v2-quickadd"} onPointerDown={(e) => e.stopPropagation()}>
      <input
        ref={input}
        type="search"
        className="v2-quickadd-input"
        placeholder={placeholder || (inTrip ? "Add a stop to this trip  ( / )" : "Search a place to add  ( / )")}
        aria-label={ariaLabel || (inTrip ? "Search a place to add to this trip" : "Search a place to add")}
        role="combobox"
        aria-expanded={!!showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && sel >= 0 ? `${listId}-${sel}` : undefined}
        value={q}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => { if (results.length) setOpen(true); }}
        onBlur={() => { if (!dialog) setTimeout(() => setOpen(false), 150); }}
        onKeyUp={(e) => { if (inline && e.key === "Escape") e.stopPropagation(); }}
        autoComplete="off"
        spellCheck={false}
      />
      {busy && <span className="v2-quickadd-busy" aria-hidden="true" />}
      {showList && (
        <ul id={listId} className="v2-quickadd-list" role="listbox">
          {error && <li className="v2-quickadd-note" role="status">{error}</li>}
          {!error && results.length === 0 && <li className="v2-quickadd-note" role="status">No places found. Try a different spelling.</li>}
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === sel}
              className={`v2-quickadd-item${i === sel ? " is-sel" : ""}`}
              onMouseEnter={() => setSel(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
            >
              <span className="v2-quickadd-name">{r.name}</span>
              <span className="v2-quickadd-meta">{[r.region, r.country].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
      {dialog && (onTypeTrip || onBuildTrip) && (
        <>
          <div className="v2-quickadd-or" aria-hidden="true">or</div>
          <div className="v2-quickadd-links">
            {onTypeTrip && <button type="button" className="v2-quickadd-link" onClick={onTypeTrip}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7V5h16v2M12 5v14M9 19h6" /></svg><span>Type a trip</span></button>}
            {onBuildTrip && <button type="button" className="v2-quickadd-link" onClick={onBuildTrip}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="5" cy="6" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="5" cy="18" r="1.5" /><path d="M10 6h10M10 12h10M10 18h10" /></svg><span>Build a trip step by step</span></button>}
          </div>
        </>
      )}
      {dialog && (
        <button type="button" className="v2-btn v2-quickadd-cancel" onClick={() => onCancel?.()}>Cancel</button>
      )}
    </div>
  );
  if (!dialog) return box;
  // Add entry: the same search in a modal. Nothing is created until a place is picked.
  return (
    <div className="v2-quickadd-backdrop" role="dialog" aria-modal="true" aria-label="Pick a place for the new entry" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onCancel?.(); }}>
      <p className="v2-quickadd-title">Where was this?</p>
      {box}
    </div>
  );
}
