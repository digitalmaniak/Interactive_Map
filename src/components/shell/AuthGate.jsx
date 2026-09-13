"use client";

/**
 * Session loading overlay + auth UI:
 * magic link, Google OAuth, and email/password (kept during transition).
 */
export default function AuthGate({
  authLoading,
  authBusy,
  session,
  isSignUp,
  setIsSignUp,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authError,
  magicLinkSent,
  handleAuth,
  handleMagicLink,
  handleGoogle,
}) {
  if (authLoading) {
    return (
      <div
        style={{
          position: "absolute",
          zIndex: 9999,
          width: "100vw",
          height: "100vh",
          background: "#0f172a",
        }}
      />
    );
  }

  if (!session) {
    const inputStyle = {
      padding: "0.75rem",
      borderRadius: "6px",
      border: "none",
      background: "rgba(255,255,255,0.8)",
      color: "#000",
      width: "100%",
      boxSizing: "border-box",
    };
    const primaryBtn = {
      background: "var(--accent)",
      color: "white",
      padding: "0.75rem",
      borderRadius: "6px",
      border: "none",
      cursor: authBusy ? "wait" : "pointer",
      fontWeight: "bold",
      width: "100%",
      opacity: authBusy ? 0.7 : 1,
    };
    const secondaryBtn = {
      background: "rgba(255,255,255,0.12)",
      color: "#fff",
      padding: "0.75rem",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.25)",
      cursor: authBusy ? "wait" : "pointer",
      fontWeight: 600,
      width: "100%",
      opacity: authBusy ? 0.7 : 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
    };
    const divider = {
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      margin: "0.25rem 0",
      color: "rgba(255,255,255,0.55)",
      fontSize: "0.75rem",
    };
    const dividerLine = {
      flex: 1,
      height: 1,
      background: "rgba(255,255,255,0.2)",
    };

    return (
      <div
        style={{
          position: "absolute",
          zIndex: 9999,
          width: "100vw",
          height: "100vh",
          background: "rgba(15, 23, 42, 0.8)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
          fontFamily: "sans-serif",
          backdropFilter: "blur(5px)",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            padding: "2rem",
            borderRadius: "12px",
            width: "340px",
            maxWidth: "92vw",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 4px 30px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
          }}
        >
          <h2 style={{ textAlign: "center", marginBottom: "0.25rem" }}>
            {isSignUp ? "Create Account" : "Sign in"}
          </h2>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.65)",
              marginBottom: "0.25rem",
            }}
          >
            Magic link, Google, or email &amp; password
          </p>

          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            disabled={authBusy}
            style={inputStyle}
          />

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={authBusy}
            style={primaryBtn}
          >
            {authBusy ? "Working…" : "Email me a magic link"}
          </button>

          <div style={divider}>
            <span style={dividerLine} />
            <span>or</span>
            <span style={dividerLine} />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={authBusy}
            style={secondaryBtn}
            aria-label="Continue with Google"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div style={divider}>
            <span style={dividerLine} />
            <span>or password</span>
            <span style={dividerLine} />
          </div>

          <form
            onSubmit={handleAuth}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <input
              type="password"
              placeholder="Password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              disabled={authBusy}
              style={inputStyle}
            />
            <button type="submit" disabled={authBusy} style={primaryBtn}>
              {authBusy
                ? "Working…"
                : isSignUp
                  ? "Sign up with password"
                  : "Sign in with password"}
            </button>
          </form>

          {authError ? (
            <p
              role="alert"
              style={{
                color: "#fecaca",
                fontSize: "0.8rem",
                textAlign: "center",
                margin: 0,
              }}
            >
              {authError}
            </p>
          ) : null}

          {magicLinkSent && !authError ? (
            <p
              style={{
                color: "#bbf7d0",
                fontSize: "0.8rem",
                textAlign: "center",
                margin: 0,
              }}
            >
              Check your email for the link to continue.
            </p>
          ) : null}

          <div style={{ textAlign: "center", fontSize: "0.8rem" }}>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={authBusy}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Need an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
