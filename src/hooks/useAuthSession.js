"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";

/**
 * Auth session + email/password login/signup state extracted from MapCanvas.
 * Behavior-identical: getSession, onAuthStateChange, handleAuth (email/password only).
 */
export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

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
    setAuthLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) alert(error.message);
      else alert("Check your email for the login link!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) alert(error.message);
    }
    setAuthLoading(false);
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
    handleAuth,
  };
}
