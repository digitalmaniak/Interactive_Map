"use client";

/**
 * Session loading overlay + auth UI:
 * magic link, Google OAuth, and email/password (kept during transition).
 * v2 look (DESIGN.md v2 tokens). Visual only, auth behaviour unchanged.
 */
import BackdropGlobe from "../map/scene/BackdropGlobe";
import Crosshairs from "./Crosshairs";

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
      <div className="auth-gate v2-screen" aria-busy="true">
        <div className="v2-loading-line" role="status">Loading</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-gate v2-screen">
        <BackdropGlobe />
        <div className="v2-backdrop-dim" aria-hidden="true" />
        <Crosshairs />
        <div className="v2-wordmark auth-wordmark">Odyssey</div>

        <main className="auth-card v2-panel" aria-labelledby="auth-title">
          <div className="v2-eyebrow">{isSignUp ? "New account" : "Welcome back"}</div>
          <h1 id="auth-title" className="v2-title-md">
            {isSignUp ? "Create account" : "Sign in"}
          </h1>
          <p className="v2-muted auth-sub">Magic link, Google, or email and password</p>

          <label className="v2-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            className="v2-input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            disabled={authBusy}
          />

          <button type="button" className="v2-btn v2-btn-primary" onClick={handleMagicLink} disabled={authBusy}>
            {authBusy ? "Working…" : "Email me a magic link"}
          </button>

          <div className="v2-divider"><span>or</span></div>

          <button
            type="button"
            className="v2-btn v2-btn-ghost"
            onClick={handleGoogle}
            disabled={authBusy}
            aria-label="Continue with Google"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="v2-divider"><span>or password</span></div>

          <form onSubmit={handleAuth} className="auth-form">
            <label className="v2-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="v2-input"
              type="password"
              placeholder="Password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              disabled={authBusy}
            />
            <button type="submit" className="v2-btn v2-btn-primary" disabled={authBusy}>
              {authBusy ? "Working…" : isSignUp ? "Sign up with password" : "Sign in with password"}
            </button>
          </form>

          {authError ? (
            <p role="alert" className="v2-notice v2-notice-error">{authError}</p>
          ) : null}

          {magicLinkSent && !authError ? (
            <p role="status" className="v2-notice v2-notice-ok">
              Link sent. Check your email to continue.
            </p>
          ) : null}

          <button
            type="button"
            className="v2-btn v2-btn-link"
            onClick={() => setIsSignUp(!isSignUp)}
            disabled={authBusy}
          >
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </main>
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
