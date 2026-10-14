// ISO 3166-1 alpha-2 code -> English display name ("CR" -> "Costa Rica"). Null when unknown.
let dn = null;
export function countryName(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  try {
    dn = dn || new Intl.DisplayNames(["en"], { type: "region" });
    const n = dn.of(c);
    return n && n !== c ? n : null;
  } catch {
    return null;
  }
}
