"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";

/** Same-origin redirect for magic link + Google (prod + localhost). */
function authRedirectTo() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://interactive-map-indol.vercel.app";
}

/**
 * Auth session + email/password, magic link (OTP), and Google OAuth.
 * Password sign-in/sign-up kept during transition.
 */
export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setMagicLinkSent(false);
    setAuthBusy(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { emailRedirectTo: authRedirectTo() },
        });
        if (error) setAuthError(error.message);
        else {
          setAuthError(null);
          setMagicLinkSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) setAuthError(error.message);
      }
    } catch (err) {
      setAuthError(err?.message || "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleMagicLink = async (e) => {
    e?.preventDefault?.();
    setAuthError(null);
    setMagicLinkSent(false);
    const email = (authEmail || "").trim();
    if (!email) {
      setAuthError("Enter your email to receive a magic link.");
      return;
    }
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authRedirectTo() },
      });
      if (error) setAuthError(error.message);
      else setMagicLinkSent(true);
    } catch (err) {
      setAuthError(err?.message || "Could not send magic link");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogle = async () => {
    setAuthError(null);
    setMagicLinkSent(false);
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirectTo() },
      });
      if (error) {
        setAuthError(error.message);
        setAuthBusy(false);
      }
      // On success the browser navigates away; leave busy true.
    } catch (err) {
      setAuthError(err?.message || "Google sign-in failed");
      setAuthBusy(false);
    }
  };

  return {
    session,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    isSignUp,
    setIsSignUp,
    authLoading,
    authBusy,
    authError,
    magicLinkSent,
    handleAuth,
    handleMagicLink,
    handleGoogle,
  };
}
