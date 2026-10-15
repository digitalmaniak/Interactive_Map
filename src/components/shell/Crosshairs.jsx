// Corner L marks in the four corners (Prism: 16px arms, 16px inset, 1px, white 0.3).
export default function Crosshairs() {
  return (
    <div className="v2-crosshairs" aria-hidden="true">
      <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
    </div>
  );
}
