
import { useEffect, useState } from "react";
import "./Auth.css";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";
import App from "./App";

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });

    return unsubscribe;
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const messages = {
        "auth/email-already-in-use": "This email already has an account. Try logging in.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Your password must be at least 6 characters.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
        "auth/network-request-failed": "Network error. Check your internet connection.",
      };

      setError(messages[err.code] || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <div className="auth-loading">Loading your fitness space...</div>;
  }

  if (user) {
    return <App userId={user.uid} userEmail={user.email || ""} onLogout={() => signOut(auth)} />;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">F</span>
          <span>FIT<span className="auth-accent">TRACK</span></span>
        </div>

        <p className="auth-eyebrow">YOUR PERSONAL FITNESS SPACE</p>
        <h1>{isRegistering ? "Create your account" : "Welcome back."}</h1>
        <p className="auth-description">
          {isRegistering
            ? "Start building stronger and more consistent habits."
            : "Sign in to continue your fitness journey."}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isRegistering
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering ? "Already have an account?" : "New to FitTrack?"}
          {" "}
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError("");
            }}
          >
            {isRegistering ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
