import { useEffect, useState } from "react";
import "./Auth.css";
import "./PrivacyPolicy.css";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import App from "./App";

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!showPrivacyPolicy) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowPrivacyPolicy(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showPrivacyPolicy]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim();

    if (isRegistering) {
      const trimmedName = name.trim();

      if (!trimmedName) {
        setError("Please enter your name or username.");
        return;
      }

      if (password.length < 8) {
        setError("Your password must be at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Your passwords do not match. Please try again.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });

        setUser(credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );

        setUser(credential.user);
      }
    } catch (err) {
      const messages = {
        "auth/email-already-in-use":
          "This email already has an account. Try logging in.",
        "auth/invalid-email":
          "Please enter a valid email address.",
        "auth/weak-password":
          "Your password must be at least 8 characters.",
        "auth/invalid-credential":
          "Incorrect email or password.",
        "auth/user-not-found":
          "No account was found with these details.",
        "auth/wrong-password":
          "Incorrect email or password.",
        "auth/too-many-requests":
          "Too many attempts. Please try again later.",
        "auth/network-request-failed":
          "Network error. Check your internet connection.",
        "auth/operation-not-allowed":
          "Email and password sign-in is not enabled in Firebase.",
      };

      setError(
        messages[err.code] ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setIsRegistering((current) => !current);
    setError("");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  if (checking) {
    return (
      <div className="auth-loading">
        Loading your fitness space...
      </div>
    );
  }

  if (user) {
    return (
      <App
        key={user.uid}
        userId={user.uid}
        userEmail={user.email || ""}
        userName={user.displayName || ""}
        onLogout={() => signOut(auth)}
      />
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">F</span>
          <span>
            FIT<span className="auth-accent">TRACK</span>
          </span>
        </div>

        <p className="auth-eyebrow">
          YOUR PERSONAL FITNESS SPACE
        </p>

        <h1>
          {isRegistering
            ? "Create your account"
            : "Welcome back."}
        </h1>

        <p className="auth-description">
          {isRegistering
            ? "Start building stronger and more consistent habits."
            : "Sign in to continue your fitness journey."}
        </p>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          {isRegistering && (
            <label>
              Your name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="What should we call you?"
                autoComplete="nickname"
                maxLength={40}
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            {isRegistering ? "Create password" : "Password"}

            <span className="auth-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  isRegistering
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                autoComplete={
                  isRegistering
                    ? "new-password"
                    : "current-password"
                }
                minLength={isRegistering ? 8 : undefined}
                required
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          {isRegistering && (
            <label>
              Confirm password

              <span className="auth-password-wrap">
                <input
                  type={
                    showConfirmPassword ? "text" : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter it again"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isRegistering
                ? "Create account  →"
                : "Log in  →"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering
            ? "Already have an account?"
            : "New to FitTrack?"}{" "}
          <button
            type="button"
            onClick={switchMode}
          >
            {isRegistering ? "Log in" : "Sign up"}
          </button>
        </p>

        <div className="auth-privacy-footer">
          <button
            className="auth-privacy-link"
            type="button"
            onClick={() => setShowPrivacyPolicy(true)}
          >
            Privacy Policy
          </button>

          <span aria-hidden="true">·</span>
          <span>FITTRACK</span>
        </div>
      </div>

      {showPrivacyPolicy && (
        <div
          className="privacy-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowPrivacyPolicy(false);
            }
          }}
        >
          <section
            className="privacy-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-policy-title"
          >
            <div className="privacy-modal-header">
              <div>
                <p className="privacy-modal-eyebrow">
                  FITTRACK · YOUR DATA
                </p>
                <h2 id="privacy-policy-title">
                  Privacy Policy
                </h2>
                <p className="privacy-updated">
                  Last updated: October 25, 2026
                </p>
              </div>

              <button
                type="button"
                className="privacy-close"
                aria-label="Close Privacy Policy"
                onClick={() => setShowPrivacyPolicy(false)}
              >
                ×
              </button>
            </div>

            <div className="privacy-modal-content">
              <p>
                This Privacy Policy explains how FITTRACK handles
                information when you use this workout and
                habit-tracking application. Use FITTRACK only with
                information you are comfortable storing in the app.
              </p>

              <h3>1. Information we store</h3>
              <p>Depending on the features you use, FITTRACK may store:</p>
              <ul>
                <li>
                  <strong>Account information:</strong> your email
                  address and Firebase account identifier, used for
                  sign-in and account separation.
                </li>
                <li>
                  <strong>Fitness information:</strong> workout dates,
                  exercises, sets, repetitions, weights lifted, notes,
                  goals, body-weight entries, workout drafts, templates,
                  achievements, and progress summaries you enter.
                </li>
                <li>
                  <strong>Profile and community information:</strong>
                  your chosen profile name, avatar, XP, rank, workout
                  count, friend requests, and accepted friendships.
                  Profile details used by friends or the leaderboard
                  may be visible to other FITTRACK users.
                </li>
                <li>
                  <strong>Local storage:</strong> FITTRACK may save
                  account-specific copies of your app data in your
                  browser to support the experience and help retain
                  data between visits.
                </li>
              </ul>

              <h3>2. How information is used</h3>
              <p>
                Information is used to sign you in, display your
                fitness dashboard, calculate progress and achievements,
                save your data, and support friend and leaderboard
                features. FITTRACK does not need your workout notes to
                identify you personally; avoid entering sensitive
                information into notes.
              </p>

              <h3>3. Firebase and data storage</h3>
              <p>
                FITTRACK uses Firebase Authentication and Cloud
                Firestore to provide account sign-in and cloud data
                storage. Information sent to these services is handled
                subject to Google's applicable service terms and
                privacy documentation. Data may also remain in your
                browser's local storage on the device you use.
              </p>

              <h3>4. What other users can see</h3>
              <p>
                FITTRACK includes social features. Your published
                profile details—such as display name, avatar, XP, rank,
                and workout count—may appear to other users in friend
                lists or the leaderboard. Your private workout logs
                and body-weight entries are intended to be stored in
                your own account data, not displayed as public profile
                fields.
              </p>

              <h3>5. Keeping your information safe</h3>
              <p>
                Keep your password private, sign out on shared devices,
                and use FITTRACK only on devices and networks you
                trust. No online service or local device storage can
                be guaranteed completely secure. Access to private
                cloud data also depends on correctly configured
                Firebase security rules.
              </p>

              <h3>6. Retention and deletion</h3>
              <p>
                Account data may remain in cloud storage and browser
                storage until it is deleted or otherwise removed.
                Signing out does not delete saved data. If you want
                your account or data deleted, contact the FITTRACK app
                administrator or developer. Browser-stored copies may
                also need to be cleared from each device you used.
              </p>

              <h3>7. Children's privacy</h3>
              <p>
                FITTRACK is not designed to knowingly collect personal
                information from children without appropriate
                permission from a parent or guardian. If you believe
                a child has provided information inappropriately,
                contact the app administrator.
              </p>

              <h3>8. Changes to this policy</h3>
              <p>
                This policy may be updated as FITTRACK changes. The
                latest version and its update date will be shown here.
              </p>

              <h3>9. Contact</h3>
              <p>
                For privacy questions or data-deletion requests,
                contact the FITTRACK app administrator or developer
                through the channel provided by the person or
                organization operating this app.
              </p>

              <p className="privacy-note">
                This is a general in-app privacy notice for FITTRACK,
                not legal advice. The app owner should review it
                against the deployed app, Firebase security rules,
                and applicable privacy requirements before publication.
              </p>
            </div>

            <div className="privacy-modal-actions">
              <button
                type="button"
                className="auth-submit"
                onClick={() => setShowPrivacyPolicy(false)}
              >
                Close policy
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}