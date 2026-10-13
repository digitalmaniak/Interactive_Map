// Small + crosshairs in the four corners (DESIGN.md v2 chrome).
export default function Crosshairs() {
  return (
    <div className="v2-crosshairs" aria-hidden="true">
      <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
    </div>
  );
}
