"use client";

/**
 * Session loading overlay + email/password login/signup forms.
 * Presentational; state/handlers come from useAuthSession via MapCanvas.
 * No magic link / Google in this PR — email/password only.
 */
export default function AuthGate({
  authLoading,
  session,
  isSignUp,
  setIsSignUp,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  handleAuth,
}) {
  if (authLoading) {
    return (
      <div style={{ position: "absolute", zIndex: 9999, width: "100vw", height: "100vh", background: "#0f172a" }} />
    );
  }

  if (!session) {
    return (
      <div style={{ position: "absolute", zIndex: 9999, width: "100vw", height: "100vh", background: "rgba(15, 23, 42, 0.8)", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontFamily: "sans-serif", backdropFilter: "blur(5px)" }}>
        <div style={{ background: "rgba(255,255,255,0.1)", padding: "2rem", borderRadius: "12px", width: "300px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 4px 30px rgba(0,0,0,0.1)" }}>
          <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>{isSignUp ? "Create Account" : "Login"}</h2>
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ padding: "0.75rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.8)", color: "#000" }} />
            <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: "0.75rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.8)", color: "#000" }} />
            <button type="submit" disabled={authLoading} style={{ background: "var(--accent)", color: "white", padding: "0.75rem", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
              {authLoading ? "Loading..." : (isSignUp ? "Sign Up" : "Login")}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem" }}>
            <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}>
              {isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
