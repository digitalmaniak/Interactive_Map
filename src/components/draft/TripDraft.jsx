"use client";
// Trip draft card (Prism items 3 and 4). One glass card, three faces:
// - start: "Where did you go?" textarea plus two quiet links (new users, or "Type a trip")
// - edit: the growing trip card used by both the guided flow and the typed preview.
//   Trip name and dates, stop rows with the shared place search, and between stops a
//   "How did you get to the next one?" row with mode icons. Fly asks for two airports.
// Nothing is saved until Save. Save stays disabled until every stop has a location.
import { useState } from "react";
import QuickAdd from "../quickadd/QuickAdd";
import { LEG_MODES, MODE_LABEL, NO_DATE_WARNING, canSave, hasLocation, saveHint, warningsFor } from "../../lib/draft/draft";
import ModeIcon from "../shell/ModeIcon";

const PLACEHOLDER = "Paris in May 2024, flew from JFK, took the train to Lyon";

// Legs between consecutive stops, one per gap (creates missing ones with no mode yet).
export function syncLegs(draft) {
  const n = draft.stops.length;
  const legs = [];
  for (let i = 0; i + 1 < n; i++) {
    const found = draft.legs.find((l) => l.from_stop === i && l.to_stop === i + 1);
    legs.push(found || { mode: null, from_stop: i, to_stop: i + 1, date: null, from_label: null, to_label: null });
  }
  // Keep any other parsed legs (a return flight, say) after the consecutive ones.
  for (const l of draft.legs) if (!(l.to_stop === l.from_stop + 1) && l.from_stop < n && l.to_stop < n) legs.push(l);
  return { ...draft, legs };
}

function Warn({ list, id, openId, setOpenId }) {
  if (!list.length) return null;
  const open = openId === id;
  return (
    <>
      <button type="button" className="v2-draft-warn" aria-label={`Check this: ${list[0]}`} aria-expanded={open} onClick={() => setOpenId(open ? null : id)} />
      {open && <div className="v2-draft-warn-text" role="note">{list.join(" ")}</div>}
    </>
  );
}

export default function TripDraft({ face, text, setText, onSubmitText, parsing, error, stub, onStartGuided, onAddSingle, draft, setDraft, onSave, saving, saveError, onClose, onDiscard, resumable = false, onResume, showLinks = true }) {
  const [openWarn, setOpenWarn] = useState(null);
  const [changing, setChanging] = useState(null); // stop index whose place is being changed

  if (face === "start") {
    return (
      <div className="v2-draft v2-draft-start" role="dialog" aria-label="Start a trip" onPointerDown={(e) => e.stopPropagation()}>
        {onClose && <button type="button" className="v2-draft-x" aria-label="Close" onClick={onClose}>×</button>}
        <label className="v2-draft-title" htmlFor="v2-draft-text">Where did you go?</label>
        <textarea id="v2-draft-text" className="v2-draft-textarea" rows={4} placeholder={PLACEHOLDER} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmitText(); } }} />
        {error && <p className="v2-draft-error" role="alert">{error}</p>}
        <button type="button" className="v2-btn v2-btn-primary v2-draft-go" disabled={!text.trim() || parsing} onClick={onSubmitText}>{parsing ? "Reading your trip" : "Show my trip"}</button>
        {showLinks && (
          <div className="v2-draft-links">
            <button type="button" className="v2-link" onClick={onAddSingle}>Add a single place</button>
            {resumable
              ? <button type="button" className="v2-link" onClick={onResume}>Continue your draft</button>
              : <button type="button" className="v2-link" onClick={onStartGuided}>Build a trip step by step</button>}
          </div>
        )}
      </div>
    );
  }

  const d = draft;
  const set = (fn) => setDraft((cur) => syncLegs(fn(cur)));
  const setStop = (i, patch) => set((cur) => ({ ...cur, stops: cur.stops.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const setLeg = (i, patch) => set((cur) => ({ ...cur, legs: cur.legs.map((l, k) => (k === i ? { ...l, ...patch, guessed: false } : l)) }));
  const placeFromPick = (r) => ({ name: r.name, lat: Number(r.lat), lng: Number(r.lng), country_code: r.countryCode || null, guessed: false });
  const addStop = (r) => set((cur) => ({ ...cur, stops: [...cur.stops, { ...placeFromPick(r), date: null }] }));
  const removeStop = (i) => set((cur) => ({
    ...cur,
    stops: cur.stops.filter((_, k) => k !== i),
    legs: cur.legs.filter((l) => l.from_stop !== i && l.to_stop !== i).map((l) => ({ ...l, from_stop: l.from_stop > i ? l.from_stop - 1 : l.from_stop, to_stop: l.to_stop > i ? l.to_stop - 1 : l.to_stop })),
  }));
  const ready = canSave(d);
  const hint = saveHint(d);

  return (
    <div className="v2-draft v2-draft-edit" role="dialog" aria-label="Trip draft" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="v2-draft-x" aria-label="Close and keep the draft" onClick={onClose}>×</button>
      {stub && <p className="v2-draft-note">Preview from the offline reader. Check each item.</p>}
      <input className="v2-draft-name panel-input" placeholder="Trip name" aria-label="Trip name" value={d.journey.title}
        onChange={(e) => setDraft((cur) => ({ ...cur, journey: { ...cur.journey, title: e.target.value } }))} />
      <div className="v2-draft-dates">
        <input type="date" className="panel-input" aria-label="Start date" value={d.journey.date_start || ""} onChange={(e) => setDraft((cur) => ({ ...cur, journey: { ...cur.journey, date_start: e.target.value || null } }))} />
        <span aria-hidden="true">to</span>
        <input type="date" className="panel-input" aria-label="End date" value={d.journey.date_end || ""} onChange={(e) => setDraft((cur) => ({ ...cur, journey: { ...cur.journey, date_end: e.target.value || null } }))} />
      </div>

      <ol className="v2-draft-list">
        {d.stops.map((s, i) => {
          const leg = d.legs[i] && d.legs[i].from_stop === i && d.legs[i].to_stop === i + 1 ? d.legs[i] : null;
          const located = hasLocation(s);
          return (
            <li key={`s${i}`} className="v2-draft-item">
              <div className={`v2-draft-stop${s.guessed ? " is-guessed" : ""}${located ? "" : " is-missing"}`} data-stop={i}>
                <span className="v2-draft-num">{i + 1}</span>
                <div className="v2-draft-stop-main">
                  {located && changing !== i ? (
                    <button type="button" className="v2-draft-place" onClick={() => setChanging(i)} aria-label={`Change ${s.name}`}>{s.name}</button>
                  ) : (
                    <QuickAdd inline autoFocus={changing === i} initialQuery={located ? "" : s.name} placeholder={located ? "Search a new place" : `Find ${s.name || "this place"}`}
                      ariaLabel={`Find a place for stop ${i + 1}`} onPick={(r) => { setStop(i, placeFromPick(r)); setChanging(null); }} />
                  )}
                  <input type="date" className="panel-input v2-draft-stop-date" aria-label={`Date for stop ${i + 1}`} value={s.date || ""} onChange={(e) => setStop(i, { date: e.target.value || null })} />
                </div>
                <Warn list={[...(s.guessed || !located ? warningsFor(d, "stop", i) : []), ...(s.date ? [] : [NO_DATE_WARNING])]} id={`s${i}`} openId={openWarn} setOpenId={setOpenWarn} />
                <button type="button" className="v2-draft-rm" aria-label={`Remove stop ${i + 1}`} onClick={() => removeStop(i)}>×</button>
              </div>
              {leg && (
                <div className={`v2-draft-leg${leg.guessed ? " is-guessed" : ""}`} data-leg={i}>
                  <span className="v2-draft-leg-q">How did you get to the next one?</span>
                  <div className="v2-draft-modes" role="radiogroup" aria-label={`Travel from stop ${i + 1} to stop ${i + 2}`}>
                    {LEG_MODES.map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={leg.mode === m} aria-label={MODE_LABEL[m]} title={MODE_LABEL[m]}
                        className={`v2-draft-mode${leg.mode === m ? " is-on" : ""}`} onClick={() => setLeg(i, { mode: m })}><ModeIcon mode={m} /></button>
                    ))}
                  </div>
                  <Warn list={leg.guessed ? warningsFor(d, "leg", i) : []} id={`l${i}`} openId={openWarn} setOpenId={setOpenWarn} />
                  {leg.mode === "fly" && (
                    <div className="v2-draft-airports">
                      <input className="panel-input" placeholder="From airport, like JFK" aria-label="From airport" value={leg.from_label || ""} onChange={(e) => setLeg(i, { from_label: e.target.value || null })} />
                      <input className="panel-input" placeholder="To airport, like CDG" aria-label="To airport" value={leg.to_label || ""} onChange={(e) => setLeg(i, { to_label: e.target.value || null })} />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="v2-draft-add">
        <QuickAdd inline clearOnPick placeholder={d.stops.length ? "Add the next stop" : "Add your first stop"} ariaLabel="Add a stop" onPick={addStop} />
      </div>

      {saveError && <p className="v2-draft-error" role="alert">{saveError}</p>}
      <div className="v2-draft-foot">
        <button type="button" className="v2-btn v2-btn-primary" disabled={!ready || saving} aria-disabled={!ready || saving} aria-describedby={hint ? "v2-draft-save-hint" : undefined} onClick={onSave}>{saving ? "Saving" : "Save trip"}</button>
        {onDiscard && <button type="button" className="v2-link" onClick={onDiscard}>Discard</button>}
        {hint && <span className="v2-draft-hint" id="v2-draft-save-hint">{hint}</span>}
      </div>
    </div>
  );
}
