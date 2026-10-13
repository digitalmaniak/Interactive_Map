"use client";
// Quick add search: type a place, pick a suggestion, the camera flies there and the
// existing add stop form opens prefilled. Nothing is saved here; the form's own confirm
// button runs the existing pin create path.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QUICK_ADD, debounce, geocode, makeRateGate, nextIndex, shouldSearch } from "../../lib/geocode/quickAdd";

export default function QuickAdd({ onPick, inTrip = false }) {
  const [q, setQ] = useState("");
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

  // '/' focuses the search from anywhere except while typing in a field.
  useEffect(() => {
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
  }, []);

  const onChange = (e) => {
    const v = e.target.value;
    setQ(v);
    if (shouldSearch(v)) runRef.current?.(v);
    else { runRef.current?.cancel(); ctl.current?.abort(); setBusy(false); setResults([]); setSel(-1); setError(""); setOpen(false); }
  };

  const pick = useCallback((r) => {
    if (!r) return;
    setOpen(false); setQ(r.name); setResults([]); setSel(-1);
    input.current?.blur();
    onPick?.(r);
  }, [onPick]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open && results.length) setOpen(true);
      setSel((i) => nextIndex(e.key, i, results.length));
    } else if (e.key === "Enter") {
      if (open && sel >= 0) { e.preventDefault(); pick(results[sel]); }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
      else input.current?.blur();
    }
  };

  const listId = "v2-quickadd-list";
  const showList = open && (results.length > 0 || error || (!busy && shouldSearch(q)));
  return (
    <div className="v2-quickadd" onPointerDown={(e) => e.stopPropagation()}>
      <input
        ref={input}
        type="search"
        className="v2-quickadd-input"
        placeholder={inTrip ? "Add a stop to this trip  ( / )" : "Search a place to add  ( / )"}
        aria-label={inTrip ? "Search a place to add to this trip" : "Search a place to add"}
        role="combobox"
        aria-expanded={!!showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && sel >= 0 ? `${listId}-${sel}` : undefined}
        value={q}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => { if (results.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
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
    </div>
  );
}
