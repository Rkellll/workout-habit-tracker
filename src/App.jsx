
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { db } from "../firebase";
import "./App.css";

const STORAGE_KEY = "workout-habit-data";
const EXTRA_KEY = "fittrack-extra-data";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  date: today(),
  name: "",
  sets: "3",
  reps: "10",
  weight: "0",
  duration: "30",
  note: "",
});

function readStoredData(userId) {
  // Browser backups are isolated by Firebase UID. Never read the old shared
  // keys here, because they can contain another account's private data.
  if (!userId) {
    return {
      workouts: [],
      goal: 4,
      bodyWeights: [],
      drafts: [],
      templates: [],
      achievements: [],
      profile: {
        name: "Fitness Journey",
        unit: "kg",
        reminder: "18:00",
        reminderEnabled: false,
      },
    };
  }

  try {
    const saved = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${userId}`) || "{}");
    const extra = JSON.parse(localStorage.getItem(`${EXTRA_KEY}:${userId}`) || "{}");

    return {
      workouts: Array.isArray(saved.workouts) ? saved.workouts : [],
      goal: Number(saved.goal) || 4,
      bodyWeights: Array.isArray(extra.bodyWeights)
        ? extra.bodyWeights
        : [],
      drafts: Array.isArray(extra.drafts) ? extra.drafts : [],
      templates: Array.isArray(extra.templates)
        ? extra.templates
        : [],
      achievements: Array.isArray(extra.achievements)
        ? extra.achievements
        : [],
      profile: extra.profile || {
        name: "Fitness Journey",
        unit: "kg",
        reminder: "18:00",
        reminderEnabled: false,
      },
    };
  } catch {
    return {
      workouts: [],
      goal: 4,
      bodyWeights: [],
      drafts: [],
      templates: [],
      achievements: [],
      profile: {
        name: "Fitness Journey",
        unit: "kg",
        reminder: "18:00",
        reminderEnabled: false,
      },
    };
  }
}

function dateObject(value) {
  return new Date(`${value}T12:00:00`);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function weekStart(value = new Date()) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function getWeekKey(value) {
  return dateKey(weekStart(dateObject(value)));
}

function uniqueTrainingDays(workouts) {
  return [...new Set(workouts.map((w) => w.date))].sort();
}

function weeklyStreak(workouts, goal) {
  const weeks = new Map();

  for (const workout of workouts) {
    if (!workout.date) continue;
    const key = getWeekKey(workout.date);
    const days = weeks.get(key) || new Set();
    days.add(workout.date);
    weeks.set(key, days);
  }

  const currentWeek = getWeekKey(today());
  const completedWeeks = [...weeks.entries()]
    .filter(([, days]) => days.size >= goal)
    .map(([key]) => key)
    .sort();

  let longest = 0;
  let run = 0;
  let previous = null;

  for (const key of completedWeeks) {
    const current = dateObject(key);

    if (
      previous &&
      Math.round((current - previous) / 86400000) === 7
    ) {
      run += 1;
    } else {
      run = 1;
    }

    longest = Math.max(longest, run);
    previous = current;
  }

  let currentRun = 0;
  let cursor = weekStart();

  if (!weeks.has(currentWeek) || weeks.get(currentWeek).size < goal) {
    cursor.setDate(cursor.getDate() - 7);
  }

  while (true) {
    const key = dateKey(cursor);
    const days = weeks.get(key);

    if (!days || days.size < goal) break;

    currentRun += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  const thisWeekCount = new Set(
    workouts
      .filter((w) => getWeekKey(w.date) === currentWeek)
      .map((w) => w.date)
  ).size;

  return {
    current: currentRun,
    longest,
    thisWeekCount,
    remaining: Math.max(0, goal - thisWeekCount),
  };
}

function formatDate(value) {
  if (!value) return "No date";
  return dateObject(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sumDuration(workouts) {
  return workouts.reduce(
    (total, workout) => total + Number(workout.duration || 0),
    0
  );
}

function totalVolume(workouts) {
  return workouts.reduce(
    (total, workout) =>
      total +
      Number(workout.sets || 0) *
        Number(workout.reps || 0) *
        Number(workout.weight || 0),
    0
  );
}

function weekLabel(offset) {
  const start = weekStart();
  start.setDate(start.getDate() + offset * 7);
  return start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getExerciseNames(workouts) {
  return [...new Set(workouts.map((w) => w.name).filter(Boolean))].sort();
}

const RANKS = [
  { name: "Iron", min: 0, next: 500 },
  { name: "Bronze", min: 500, next: 1500 },
  { name: "Silver", min: 1500, next: 3000 },
  { name: "Gold", min: 3000, next: 5500 },
  { name: "Platinum", min: 5500, next: 9000 },
  { name: "Diamond", min: 9000, next: 15000 },
  { name: "Master", min: 15000, next: null },
];

function getRank(xp) {
  return [...RANKS].reverse().find((rank) => xp >= rank.min) || RANKS[0];
}

function calculateXp(workouts, goal, streak) {
  const workoutXp = workouts.length * 100;
  const weekCounts = new Map();
  const personalRecords = new Map();
  for (const workout of workouts) {
    if (workout.date) {
      const key = getWeekKey(workout.date);
      const days = weekCounts.get(key) || new Set();
      days.add(workout.date);
      weekCounts.set(key, days);
    }
    const name = String(workout.name || "").trim().toLowerCase();
    if (name) personalRecords.set(name, Math.max(personalRecords.get(name) || 0, Number(workout.weight || 0)));
  }
  const goalXp = [...weekCounts.values()].filter((days) => days.size >= goal).length * 250;
  const prXp = personalRecords.size * 50;
  const streakXp = Math.floor((streak?.current || 0) / 7) * 150;
  return workoutXp + goalXp + prXp + streakXp;
}

function App({ userId, userEmail = "", onLogout }) {
  const initial = useMemo(() => readStoredData(userId), [userId]);
  const cloudReadyRef = useRef(false);
  const cloudDataRef = useRef("");
  const [cloudStatus, setCloudStatus] = useState("connecting");

  const [workouts, setWorkouts] = useState(initial.workouts);
  const [goal, setGoal] = useState(initial.goal);
  const [bodyWeights, setBodyWeights] = useState(initial.bodyWeights);
  const [drafts, setDrafts] = useState(initial.drafts);
  const [templates, setTemplates] = useState(initial.templates);
  const [achievements, setAchievements] = useState(initial.achievements);
  const [profile, setProfile] = useState(initial.profile);

  const [tab, setTab] = useState("Dashboard");
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [weightDate, setWeightDate] = useState(today());
  const [draftName, setDraftName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Keep a separate local backup for each signed-in account. Do not write
  // anything until that account's Firestore document has loaded successfully.
  useEffect(() => {
    if (!userId || !cloudReadyRef.current) return;
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify({ workouts, goal }));
  }, [userId, workouts, goal, cloudStatus]);

  useEffect(() => {
    if (!userId || !cloudReadyRef.current) return;
    localStorage.setItem(
      `${EXTRA_KEY}:${userId}`,
      JSON.stringify({ bodyWeights, drafts, templates, achievements, profile })
    );
  }, [userId, bodyWeights, drafts, templates, achievements, profile, cloudStatus]);

  const cloudData = useMemo(() => ({
    workouts,
    goal,
    bodyWeights,
    drafts,
    templates,
    achievements,
    profile,
  }), [workouts, goal, bodyWeights, drafts, templates, achievements, profile]);

  // Each account gets its own Firestore document. If it has no cloud document
  // yet, only that same UID's isolated local backup may be migrated. The old
  // shared localStorage keys are deliberately not imported into new accounts.
  useEffect(() => {
    if (!userId) {
      cloudReadyRef.current = false;
      setCloudStatus("Sign in to sync");
      return undefined;
    }

    cloudReadyRef.current = false;
    setCloudStatus("Connecting to cloud…");
    const userDoc = doc(db, "users", userId, "data", "fittrack");

    const unsubscribe = onSnapshot(
      userDoc,
      async (snapshot) => {
        if (snapshot.exists()) {
          const remote = snapshot.data();
          const normalized = {
            workouts: Array.isArray(remote.workouts) ? remote.workouts : [],
            goal: Number(remote.goal) || 4,
            bodyWeights: Array.isArray(remote.bodyWeights) ? remote.bodyWeights : [],
            drafts: Array.isArray(remote.drafts) ? remote.drafts : [],
            templates: Array.isArray(remote.templates) ? remote.templates : [],
            achievements: Array.isArray(remote.achievements) ? remote.achievements : [],
            profile: remote.profile || {
              name: "Fitness Journey", unit: "kg", reminder: "18:00", reminderEnabled: false,
            },
          };
          cloudDataRef.current = JSON.stringify(normalized);
          setWorkouts(normalized.workouts);
          setGoal(normalized.goal);
          setBodyWeights(normalized.bodyWeights);
          setDrafts(normalized.drafts);
          setTemplates(normalized.templates);
          setAchievements(normalized.achievements);
          setProfile(normalized.profile);
          cloudReadyRef.current = true;
          setCloudStatus("Cloud synced");
        } else {
          // First-time cloud setup: use only this account's own local backup.
          // A new account with no backup starts with clean, independent data.
          const local = readStoredData(userId);
          const serialized = JSON.stringify(local);
          cloudDataRef.current = serialized;
          try {
            await setDoc(userDoc, { ...local, updatedAt: new Date().toISOString() });
            setWorkouts(local.workouts);
            setGoal(local.goal);
            setBodyWeights(local.bodyWeights);
            setDrafts(local.drafts);
            setTemplates(local.templates);
            setAchievements(local.achievements);
            setProfile(local.profile);
            cloudReadyRef.current = true;
            setCloudStatus("Cloud synced");
          } catch (error) {
            console.error("Could not initialize FitTrack cloud data:", error);
            setCloudStatus("Cloud sync failed");
          }
        }
      },
      (error) => {
        console.error("Firestore sync error:", error);
        cloudReadyRef.current = false;
        setCloudStatus("Cloud sync failed");
      }
    );

    return () => {
      unsubscribe();
      cloudReadyRef.current = false;
    };
  }, [userId]);

  // Write changes to the signed-in user's Firestore document. Snapshot updates
  // from another device are not written back unless the data actually differs.
  useEffect(() => {
    if (!userId || !cloudReadyRef.current) return;
    const serialized = JSON.stringify(cloudData);
    if (serialized === cloudDataRef.current) return;

    cloudDataRef.current = serialized;
    setCloudStatus("Saving to cloud…");
    const userDoc = doc(db, "users", userId, "data", "fittrack");
    setDoc(userDoc, { ...cloudData, updatedAt: new Date().toISOString() }, { merge: true })
      .then(() => setCloudStatus("Cloud synced"))
      .catch((error) => {
        console.error("Could not save FitTrack cloud data:", error);
        setCloudStatus("Cloud sync failed");
      });
  }, [userId, cloudData]);

  // Publish only the summary needed for the friends list and leaderboard.
  const streakForProfile = useMemo(() => weeklyStreak(workouts, goal), [workouts, goal]);
  const xpForProfile = useMemo(() => calculateXp(workouts, goal, streakForProfile), [workouts, goal, streakForProfile]);
  const rankForProfile = getRank(xpForProfile);

  useEffect(() => {
    if (!userId || !cloudReadyRef.current) return;
    const publicProfileRef = doc(db, "publicProfiles", userId);
    setDoc(publicProfileRef, {
      uid: userId,
      email: String(userEmail || "").trim().toLowerCase(),
      displayName: profile.name || (userEmail ? userEmail.split("@")[0] : "FitTrack member"),
      avatarDataUrl: profile.avatarDataUrl || "",
      xp: xpForProfile,
      rank: rankForProfile.name,
      workouts: workouts.length,
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch((error) => {
      console.error("Could not update public FitTrack profile:", error);
    });
  }, [userId, userEmail, profile.name, profile.avatarDataUrl, xpForProfile, rankForProfile.name, workouts.length, cloudStatus]);

  useEffect(() => {
    if (!userId) return undefined;
    const requestsQuery = query(collection(db, "friendRequests"), where("recipientId", "==", userId), where("status", "==", "pending"));
    const stopRequests = onSnapshot(requestsQuery, (snapshot) => {
      setIncomingRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => console.error("Friend request listener error:", error));
    const friendshipQuery = query(collection(db, "friendships"), where("userIds", "array-contains", userId));
    const stopFriends = onSnapshot(friendshipQuery, async (snapshot) => {
      const ids = snapshot.docs.map((item) => (item.data().userIds || []).find((id) => id !== userId)).filter(Boolean);
      const profileResults = await Promise.all(ids.map(async (id) => {
        try {
          const profileSnap = await getDocs(query(collection(db, "publicProfiles"), where("uid", "==", id), limit(1)));
          return profileSnap.empty ? { uid: id, displayName: "FitTrack member", xp: 0, rank: "Iron", workouts: 0 } : { ...profileSnap.docs[0].data(), uid: id };
        } catch (error) {
          console.error("Could not load friend profile:", error);
          return { uid: id, displayName: "FitTrack member", xp: 0, rank: "Iron", workouts: 0 };
        }
      }));
      setFriends(profileResults);
    }, (error) => console.error("Friend list listener error:", error));
    const leaderboardQuery = query(collection(db, "publicProfiles"), orderBy("xp", "desc"), limit(50));
    const stopLeaderboard = onSnapshot(leaderboardQuery, (snapshot) => {
      setLeaderboard(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() })));
    }, (error) => console.error("Leaderboard listener error:", error));
    return () => { stopRequests(); stopFriends(); stopLeaderboard(); };
  }, [userId]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = window.setInterval(() => setTimerSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  async function sendFriendRequest(event) {
    event.preventDefault();
    setFriendError("");
    const email = friendEmail.trim().toLowerCase();
    if (!email || email === String(userEmail).toLowerCase()) {
      setFriendError("Enter another user's account email.");
      return;
    }
    setFriendBusy(true);
    try {
      const results = await getDocs(query(collection(db, "publicProfiles"), where("email", "==", email), limit(1)));
      if (results.empty) throw new Error("No FitTrack profile found for that email. Ask them to sign in to FitTrack first.");
      const target = results.docs[0].data();
      if (target.uid === userId) throw new Error("You cannot add yourself.");
      if (friends.some((friend) => friend.uid === target.uid)) throw new Error("You are already friends.");
      const requestId = `${userId}_${target.uid}`;
      await setDoc(doc(db, "friendRequests", requestId), {
        senderId: userId,
        senderEmail: String(userEmail || "").toLowerCase(),
        senderName: profile.name || (userEmail ? userEmail.split("@")[0] : "FitTrack member"),
        recipientId: target.uid,
        recipientName: target.displayName || "FitTrack member",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setFriendEmail("");
      notify("Friend request sent.");
    } catch (error) {
      setFriendError(error.message || "Could not send friend request.");
    } finally {
      setFriendBusy(false);
    }
  }

  async function acceptFriendRequest(request) {
    try {
      await updateDoc(doc(db, "friendRequests", request.id), { status: "accepted", acceptedAt: new Date().toISOString() });
      const userIds = [request.senderId, request.recipientId].sort();
      await setDoc(doc(db, "friendships", userIds.join("_")), { userIds, createdAt: new Date().toISOString() });
      notify(`You and ${request.senderName || "your friend"} are now friends.`);
    } catch (error) {
      console.error(error);
      notify("Could not accept request. Check Firestore rules.");
    }
  }

  async function declineFriendRequest(request) {
    try {
      await updateDoc(doc(db, "friendRequests", request.id), { status: "declined", declinedAt: new Date().toISOString() });
      notify("Friend request declined.");
    } catch (error) {
      console.error(error);
      notify("Could not decline request. Check Firestore rules.");
    }
  }

  const sorted = useMemo(
    () =>
      [...workouts].sort(
        (a, b) =>
          dateObject(b.date) - dateObject(a.date) ||
          String(b.id).localeCompare(String(a.id))
      ),
    [workouts]
  );

  const days = useMemo(() => uniqueTrainingDays(workouts), [workouts]);
  const streak = useMemo(
    () => weeklyStreak(workouts, goal),
    [workouts, goal]
  );

  const thisWeek = workouts.filter(
    (w) => getWeekKey(w.date) === getWeekKey(today())
  );

  const monthKey = today().slice(0, 7);
  const thisMonth = workouts.filter((w) => w.date?.startsWith(monthKey));

  const totalMinutes = sumDuration(workouts);
  const volume = totalVolume(workouts);
  const heaviest = Math.max(0, ...workouts.map((w) => Number(w.weight || 0)));

  const exerciseNames = getExerciseNames(workouts);
  const selectedExercise =
    exerciseFilter || exerciseNames[0] || "";

  const exerciseHistory = sorted
    .filter((w) => w.name === selectedExercise)
    .sort((a, b) => dateObject(a.date) - dateObject(b.date));

  const latestExercise = exerciseHistory.at(-1);
  const previousExercise =
    exerciseHistory.length > 1
      ? exerciseHistory.at(-2)
      : null;

  const personalRecord = Math.max(
    0,
    ...exerciseHistory.map((w) => Number(w.weight || 0))
  );

  const currentWeightEntry = [...bodyWeights].sort(
    (a, b) => dateObject(b.date) - dateObject(a.date)
  )[0];

  const xp = calculateXp(workouts, goal, streak);
  const rank = getRank(xp);
  const nextRank = RANKS.find((item) => item.min > xp);
  const rankProgress = nextRank ? Math.min(100, Math.max(0, ((xp - rank.min) / (nextRank.min - rank.min)) * 100)) : 100;
  const level = { level: rank.name, withinLevel: nextRank ? xp - rank.min : xp - rank.min, next: nextRank ? nextRank.min - rank.min : 0 };

  const earned = [
    {
      id: "first",
      name: "First Step",
      description: "Log your first workout.",
      icon: "🏁",
      unlocked: workouts.length >= 1,
    },
    {
      id: "five",
      name: "Getting Started",
      description: "Log five workouts.",
      icon: "💪",
      unlocked: workouts.length >= 5,
    },
    {
      id: "ten",
      name: "Consistency",
      description: "Log ten workouts.",
      icon: "🔥",
      unlocked: workouts.length >= 10,
    },
    {
      id: "twentyfive",
      name: "Dedicated",
      description: "Log twenty-five workouts.",
      icon: "🏆",
      unlocked: workouts.length >= 25,
    },
    {
      id: "goal",
      name: "Weekly Goal",
      description: "Reach your weekly training goal.",
      icon: "🎯",
      unlocked: streak.thisWeekCount >= goal,
    },
    {
      id: "hour",
      name: "Time Invested",
      description: "Complete five hours of training.",
      icon: "⏱️",
      unlocked: totalMinutes >= 300,
    },
    {
      id: "pr",
      name: "Record Breaker",
      description: "Log a weight of at least 50 kg.",
      icon: "⭐",
      unlocked: heaviest >= 50,
    },
  ];

  useEffect(() => {
    const unlocked = earned
      .filter((a) => a.unlocked)
      .map((a) => a.id);

    setAchievements((previous) =>
      [...new Set([...previous, ...unlocked])]
    );
    // Achievement unlocking is based on actual saved workout data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, goal, totalMinutes, heaviest, streak.thisWeekCount]);

  function notify(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function openNewWorkout() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEditWorkout(workout) {
    setForm({
      date: workout.date || today(),
      name: workout.name || "",
      sets: String(workout.sets ?? 3),
      reps: String(workout.reps ?? 10),
      weight: String(workout.weight ?? 0),
      duration: String(workout.duration ?? 30),
      note: workout.note || "",
    });
    setEditingId(workout.id);
    setShowForm(true);
  }

  function saveWorkout(event) {
    event.preventDefault();

    const name = form.name.trim();
    if (!name) {
      notify("Enter an exercise name first.");
      return;
    }

    const item = {
      id: editingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: form.date || today(),
      name,
      sets: Math.max(1, Number(form.sets) || 1),
      reps: Math.max(1, Number(form.reps) || 1),
      weight: Math.max(0, Number(form.weight) || 0),
      duration: Math.max(0, timerSeconds > 0 ? Math.ceil(timerSeconds / 60) : Number(form.duration) || 0),
      note: form.note.trim(),
    };

    if (editingId) {
      setWorkouts((previous) =>
        previous.map((w) => (w.id === editingId ? item : w))
      );
      notify("Workout updated.");
    } else {
      setWorkouts((previous) => [...previous, item]);
      notify("Workout saved! +100 XP");
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setTimerRunning(false);
    setTimerSeconds(0);
  }

  function deleteWorkout(id) {
    setWorkouts((previous) => previous.filter((w) => w.id !== id));
    setConfirmDelete(null);
    notify("Workout deleted.");
  }

  function saveBodyWeight(event) {
    event.preventDefault();
    const value = Number(weightInput);

    if (!value || value <= 0) {
      notify("Enter a valid body weight.");
      return;
    }

    setBodyWeights((previous) => [
      ...previous.filter((w) => w.date !== weightDate),
      { id: `${Date.now()}`, date: weightDate, weight: value },
    ]);

    setWeightInput("");
    notify("Body weight saved.");
  }

  function saveDraft() {
    const name = draftName.trim() || form.name.trim() || "Workout draft";
    const draft = {
      id: `${Date.now()}`,
      name,
      form: { ...form },
      savedAt: new Date().toISOString(),
    };

    setDrafts((previous) => [draft, ...previous]);
    setDraftName("");
    notify("Draft saved.");
  }

  function resumeDraft(draft) {
    setForm({ ...emptyForm(), ...draft.form });
    setEditingId(null);
    setShowForm(true);
  }

  function saveTemplate() {
    const name = templateName.trim() || form.name.trim();

    if (!name) {
      notify("Enter a template name or exercise name.");
      return;
    }

    setTemplates((previous) => [
      {
        id: `${Date.now()}`,
        name,
        form: { ...form, name: form.name || name },
      },
      ...previous,
    ]);

    setTemplateName("");
    notify("Template saved.");
  }

  function useTemplate(template) {
    setForm({ ...emptyForm(), ...template.form, date: today() });
    setEditingId(null);
    setShowForm(true);
  }

  function deleteDraft(id) {
    setDrafts((previous) => previous.filter((d) => d.id !== id));
  }

  function deleteTemplate(id) {
    setTemplates((previous) => previous.filter((t) => t.id !== id));
  }

  const navItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Workouts", icon: "🏋️" },
    { name: "Exercise Progress", icon: "↗" },
    { name: "Progress", icon: "◷" },
    { name: "Habit Calendar", icon: "▦" },
    { name: "Achievements", icon: "🏆" },
    { name: "Challenges", icon: "🎯" },
    { name: "Friends & Leaderboard", icon: "👥" },
    { name: "Settings", icon: "⚙" },
  ];

  function PanelHeading({ title, subtitle, action }) {
    return (
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
    );
  }

  function StatCard({ icon, label, value, note }) {
    return (
      <div className="stat-card">
        <div className="stat-top">
          <span>{label}</span>
          <span className="stat-icon">{icon}</span>
        </div>
        <div className="stat-value">{value}</div>
        {note && <div className="stat-note">{note}</div>}
      </div>
    );
  }

  function WorkoutList({ items }) {
    if (!items.length) {
      return (
        <div className="ft-empty">
          <span>🏋️</span>
          <strong>No workouts yet</strong>
          <p>Log a workout to start tracking your progress.</p>
          <button className="primary-btn" onClick={openNewWorkout}>
            + Log Workout
          </button>
        </div>
      );
    }

    return (
      <div className="workout-list">
        {items.map((w) => (
          <div className="workout-item" key={w.id}>
            <div className="exercise-icon">↗</div>
            <div className="exercise-details">
              <strong>{w.name}</strong>
              <span>
                {w.sets} sets × {w.reps} reps · {w.weight} kg
              </span>
              <small>
                {formatDate(w.date)} · {w.duration || 0} min
                {w.note ? ` · ${w.note}` : ""}
              </small>
            </div>
            <button
              className="ft-icon-button"
              title="Edit workout"
              onClick={() => openEditWorkout(w)}
            >
              ✎
            </button>
            <button
              className="delete-btn"
              title="Delete workout"
              onClick={() => setConfirmDelete(w.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }

  function BarChart({ values, labels, suffix = "" }) {
    const maximum = Math.max(1, ...values);

    return (
      <div className="ft-chart">
        {values.map((value, index) => (
          <div className="ft-chart-column" key={`${labels[index]}-${index}`}>
            <span className="ft-chart-value">
              {value ? `${value}${suffix}` : ""}
            </span>
            <div className="ft-chart-track">
              <div
                className="ft-chart-bar"
                style={{
                  height: `${Math.max(3, (value / maximum) * 100)}%`,
                }}
              />
            </div>
            <small>{labels[index]}</small>
          </div>
        ))}
      </div>
    );
  }

  function Dashboard() {
    const weeklyValues = Array.from({ length: 7 }, (_, index) => {
      const day = weekStart();
      day.setDate(day.getDate() + index);
      const key = dateKey(day);

      return new Set(
        workouts.filter((w) => w.date === key).map((w) => w.id)
      ).size;
    });

    const weeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR FITNESS JOURNAL</p>
            <h1>Dashboard</h1>
            <p>Small steps. Consistent effort. Real progress.</p>
          </div>
          <button className="primary-btn" onClick={openNewWorkout}>
            + Log Workout
          </button>
        </div>

        <div className="stats-grid">
          <StatCard
            icon="🏋️"
            label="WORKOUT ENTRIES"
            value={workouts.length}
            note={`${days.length} distinct training days`}
          />
          <StatCard
            icon="⏱️"
            label="TRAINING TIME"
            value={`${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`}
            note="All logged sessions"
          />
          <StatCard
            icon="🔥"
            label="WEEKLY STREAK"
            value={`${streak.current} wk`}
            note={`Longest: ${streak.longest} wk`}
          />
          <StatCard
            icon="🏆"
            label="HEAVIEST WEIGHT"
            value={`${heaviest} kg`}
            note="Across your exercise entries"
          />
        </div>

        <div className="content-grid">
          <section className="panel">
            <PanelHeading
              title="Weekly activity"
              subtitle="Your workout entries this week"
              action={<span className="tag">{streak.thisWeekCount}/{goal} DAYS</span>}
            />

            <div className="ft-goal-summary">
              <div className="ft-goal-ring">
                <strong>
                  {Math.min(100, Math.round((streak.thisWeekCount / goal) * 100))}%
                </strong>
              </div>
              <div>
                <strong>
                  {streak.remaining === 0
                    ? "Weekly goal complete!"
                    : `${streak.remaining} more training day${streak.remaining === 1 ? "" : "s"}`}
                </strong>
                <p>Rest days are okay. Your goal is weekly, not daily.</p>
              </div>
            </div>

            <BarChart values={weeklyValues} labels={weeklyLabels} />
            <div className="goal-editor">
              <label htmlFor="weekly-goal">Weekly training goal</label>
              <select
                id="weekly-goal"
                value={goal}
                onChange={(event) => setGoal(Number(event.target.value))}
              >
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>{n} days per week</option>
                ))}
              </select>
            </div>
          </section>

          <section className="panel">
            <PanelHeading
              title="Monthly summary"
              subtitle={new Date().toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            />
            <div className="ft-summary-list">
              <div><span>Exercise entries</span><strong>{thisMonth.length}</strong></div>
              <div>
                <span>Training days</span>
                <strong>{new Set(thisMonth.map((w) => w.date)).size}</strong>
              </div>
              <div><span>Training time</span><strong>{sumDuration(thisMonth)} min</strong></div>
              <div><span>Volume lifted</span><strong>{Math.round(totalVolume(thisMonth)).toLocaleString()} kg</strong></div>
            </div>
            <div className="ft-mini-note">
              Your summaries update automatically when you add, edit, or delete workouts.
            </div>
          </section>
        </div>

        <section className="panel ft-section-gap">
          <PanelHeading
            title="Recent workouts"
            subtitle="Your latest logged exercise entries"
            action={
              <button className="text-btn" onClick={() => setTab("Workouts")}>
                View all →
              </button>
            }
          />
          <WorkoutList items={sorted.slice(0, 5)} />
        </section>

        <section className="panel ft-section-gap ft-rpg-card">
          <PanelHeading title="Your rank" subtitle="Every session moves you closer to the next tier" />
          <div className="ft-rpg-hero">
            <div className="ft-rpg-emblem" aria-label={`${rank.name} rank`}>✦</div>
            <div className="ft-rpg-copy">
              <span className="ft-rpg-kicker">CURRENT TIER</span>
              <h3>{rank.name}</h3>
              <p>Level {level.level} <span>·</span> {xp.toLocaleString()} XP earned</p>
            </div>
            <div className="ft-rpg-xp"><strong>{rankProgress}%</strong><span>to next tier</span></div>
          </div>
          <div className="ft-rank-tiers ft-rpg-tier-track">
            {RANKS.map((tier) => <div className={`ft-rpg-tier ${tier.name === rank.name ? "active" : xp >= tier.min ? "passed" : "locked"}`} key={tier.name}><span>{xp >= tier.min ? "✦" : "◇"}</span><small>{tier.name}</small></div>)}
          </div>
          <div className="ft-rpg-progress-meta"><span>{xp.toLocaleString()} XP</span><span>{nextRank ? `${Math.max(0, nextRank.min - xp).toLocaleString()} XP to ${nextRank.name}` : "MAXIMUM RANK REACHED"}</span></div>
          <div className="ft-progress-track ft-rpg-progress"><div className="ft-progress-fill" style={{ width: `${rankProgress}%` }} /></div>
        </section>
      </>
    );
  }

  function WorkoutsPage() {
    const filtered = sorted.filter((w) =>
      `${w.name} ${w.note || ""}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR TRAINING LOG</p>
            <h1>Workouts</h1>
            <p>Record, review, and reuse your workout routines.</p>
          </div>
          <button className="primary-btn" onClick={openNewWorkout}>+ Log Workout</button>
        </div>

        <section className="panel">
          <PanelHeading
            title="Workout history"
            subtitle={`${filtered.length} exercise entries`}
          />
          <input
            className="ft-search"
            placeholder="Search exercises or notes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <WorkoutList items={filtered} />
        </section>

        <div className="content-grid ft-section-gap">
          <section className="panel">
            <PanelHeading title="Saved drafts" subtitle="Unfinished workouts you can resume" />
            <form
              className="ft-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveDraft();
              }}
            >
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Draft name (optional)"
              />
              <button className="primary-btn" type="submit">Save draft</button>
            </form>
            {drafts.length ? drafts.map((draft) => (
              <div className="ft-saved-row" key={draft.id}>
                <div><strong>{draft.name}</strong><small>{formatDate(draft.form.date)}</small></div>
                <button className="text-btn" onClick={() => resumeDraft(draft)}>Resume</button>
                <button className="delete-btn" onClick={() => deleteDraft(draft.id)}>×</button>
              </div>
            )) : <p className="ft-muted">No saved drafts yet.</p>}
          </section>

          <section className="panel">
            <PanelHeading title="Workout templates" subtitle="Save routines to reuse later" />
            <form
              className="ft-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveTemplate();
              }}
            >
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Template name"
              />
              <button className="primary-btn" type="submit">Save current form</button>
            </form>
            {templates.length ? templates.map((template) => (
              <div className="ft-saved-row" key={template.id}>
                <div><strong>{template.name}</strong><small>{template.form.name || "Workout routine"}</small></div>
                <button className="text-btn" onClick={() => useTemplate(template)}>Use</button>
                <button className="delete-btn" onClick={() => deleteTemplate(template.id)}>×</button>
              </div>
            )) : <p className="ft-muted">Save a routine from the workout form.</p>}
          </section>
        </div>
      </>
    );
  }

  function ExerciseProgressPage() {
    const values = exerciseHistory.map((w) => Number(w.weight || 0));
    const labels = exerciseHistory.map((w) =>
      dateObject(w.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );

    const difference = latestExercise && previousExercise
      ? Number(latestExercise.weight || 0) - Number(previousExercise.weight || 0)
      : null;

    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">MEASURE YOUR PROGRESS</p>
            <h1>Exercise Progress</h1>
            <p>Compare your recent performances and personal records.</p>
          </div>
        </div>

        <section className="panel">
          <PanelHeading title="Choose an exercise" subtitle="Your history is based on saved workout entries" />
          {exerciseNames.length ? (
            <select
              className="ft-select"
              value={selectedExercise}
              onChange={(event) => setExerciseFilter(event.target.value)}
            >
              {exerciseNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : (
            <p className="ft-muted">Log an exercise to see its progress here.</p>
          )}
        </section>

        {selectedExercise && (
          <>
            <div className="stats-grid ft-section-gap">
              <StatCard icon="🏆" label="PERSONAL RECORD" value={`${personalRecord} kg`} note={selectedExercise} />
              <StatCard icon="↗" label="LATEST WEIGHT" value={`${latestExercise?.weight ?? 0} kg`} note={latestExercise ? formatDate(latestExercise.date) : "No entries"} />
              <StatCard icon="🔁" label="LATEST SETS" value={`${latestExercise?.sets ?? 0} × ${latestExercise?.reps ?? 0}`} note="Sets × reps" />
              <StatCard
                icon="📊"
                label="CHANGE"
                value={difference === null ? "—" : `${difference > 0 ? "+" : ""}${difference} kg`}
                note={previousExercise ? "Compared with previous entry" : "Log another entry to compare"}
              />
            </div>

            <section className="panel ft-section-gap">
              <PanelHeading title="Weight history" subtitle="Each bar represents the weight recorded for an entry" />
              {exerciseHistory.length ? (
                <BarChart
                  values={values.slice(-10)}
                  labels={labels.slice(-10)}
                  suffix="kg"
                />
              ) : <p className="ft-muted">No exercise history yet.</p>}
            </section>

            <section className="panel ft-section-gap">
              <PanelHeading title="Exercise history" subtitle={`${exerciseHistory.length} recorded entries`} />
              <WorkoutList items={[...exerciseHistory].reverse()} />
            </section>
          </>
        )}

        <section className="panel ft-section-gap">
          <PanelHeading title="Body weight tracker" subtitle="Record your measurements over time" />
          <form className="ft-inline-form" onSubmit={saveBodyWeight}>
            <label>
              Date
              <input type="date" value={weightDate} onChange={(event) => setWeightDate(event.target.value)} />
            </label>
            <label>
              Body weight (kg)
              <input type="number" min="0.1" step="0.1" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} placeholder="e.g. 58.5" required />
            </label>
            <button className="primary-btn" type="submit">Save weight</button>
          </form>

          {bodyWeights.length > 0 && (
            <>
              <div className="ft-summary-list">
                <div><span>Latest recorded weight</span><strong>{currentWeightEntry?.weight} kg</strong></div>
                <div><span>Records saved</span><strong>{bodyWeights.length}</strong></div>
              </div>
              <BarChart
                values={[...bodyWeights]
                  .sort((a, b) => dateObject(a.date) - dateObject(b.date))
                  .slice(-10)
                  .map((w) => Number(w.weight))}
                labels={[...bodyWeights]
                  .sort((a, b) => dateObject(a.date) - dateObject(b.date))
                  .slice(-10)
                  .map((w) => dateObject(w.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}
                suffix="kg"
              />
              <div className="ft-saved-list">
                {[...bodyWeights].sort((a, b) => dateObject(b.date) - dateObject(a.date)).map((w) => (
                  <div className="ft-saved-row" key={w.id}>
                    <span>{formatDate(w.date)}</span>
                    <strong>{w.weight} kg</strong>
                    <button className="delete-btn" type="button" aria-label={`Delete weight record from ${formatDate(w.date)}`} title="Delete record" onClick={() => setBodyWeights((previous) => previous.filter((item) => item.id !== w.id))}>×</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </>
    );
  }

  function ProgressPage() {
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - i));
      const key = date.toISOString().slice(0, 7);

      return {
        label: date.toLocaleDateString(undefined, { month: "short" }),
        count: workouts.filter((w) => w.date?.startsWith(key)).length,
      };
    });

    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR FITNESS JOURNEY</p>
            <h1>Progress</h1>
            <p>Review your training volume, time, and consistency.</p>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard icon="🏋️" label="EXERCISE ENTRIES" value={workouts.length} />
          <StatCard icon="📅" label="TRAINING DAYS" value={days.length} />
          <StatCard icon="⏱️" label="TOTAL MINUTES" value={totalMinutes} />
          <StatCard icon="⚖️" label="TOTAL VOLUME" value={`${Math.round(volume).toLocaleString()} kg`} />
        </div>

        <section className="panel ft-section-gap">
          <PanelHeading title="Six-month activity" subtitle="Number of exercise entries per month" />
          <BarChart values={monthly.map((m) => m.count)} labels={monthly.map((m) => m.label)} />
        </section>

        <section className="panel ft-section-gap">
          <PanelHeading title="Exercise overview" subtitle="Best recorded weight for each exercise" />
          {exerciseNames.length ? (
            <div className="ft-pr-grid">
              {exerciseNames.map((name) => {
                const history = workouts.filter((w) => w.name === name);
                const best = Math.max(0, ...history.map((w) => Number(w.weight || 0)));
                const latest = [...history].sort((a, b) => dateObject(b.date) - dateObject(a.date))[0];

                return (
                  <article className="ft-pr-card" key={name}>
                    <div className="ft-pr-card-top"><span className="ft-pr-icon">🏆</span><span className="ft-pr-label">PERSONAL RECORD</span></div>
                    <h3>{name}</h3>
                    <div className="ft-pr-metric">{best}<span> kg</span></div>
                    <div className="ft-pr-footer"><span>{history.length} {history.length === 1 ? "entry" : "entries"}</span><span>Latest · {formatDate(latest.date)}</span></div>
                  </article>
                );
              })}
            </div>
          ) : <p className="ft-muted">Your exercise overview will appear here.</p>}
        </section>
      </>
    );
  }

  function CalendarPage() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const cells = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];

    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">CONSISTENCY OVER PERFECTION</p>
            <h1>Habit Calendar</h1>
            <p>Rest days are normal. Track your training days, not perfection.</p>
          </div>
        </div>

        <section className="panel">
          <PanelHeading
            title={now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            subtitle={`${new Set(workouts.filter((w) => w.date?.startsWith(monthKey)).map((w) => w.date)).size} training days this month`}
          />
          <div className="ft-calendar">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <strong key={day}>{day}</strong>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} />;
              const key = `${monthKey}-${String(day).padStart(2, "0")}`;
              const done = days.includes(key);
              const isToday = key === today();

              return (
                <div className={`ft-calendar-day ${done ? "done" : ""} ${isToday ? "today" : ""}`} key={key}>
                  <span>{day}</span>
                  {done && <small>✓</small>}
                </div>
              );
            })}
          </div>
          <div className="ft-legend"><span>●</span> Training day <span className="ft-legend-empty">●</span> Rest day</div>
        </section>

        <section className="panel ft-section-gap">
          <PanelHeading title="Weekly goal" subtitle="Your streak is based on meeting this target each week" />
          <div className="ft-goal-summary">
            <div className="ft-goal-ring"><strong>{streak.thisWeekCount}/{goal}</strong></div>
            <div>
              <strong>{streak.remaining === 0 ? "Goal reached" : `${streak.remaining} day(s) left this week`}</strong>
              <p>Current streak: {streak.current} weeks · Longest streak: {streak.longest} weeks</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  function AchievementsPage() {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">CELEBRATE YOUR PROGRESS</p>
            <h1>Achievements</h1>
            <p>Badges unlock when your saved workout history meets each milestone.</p>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard icon="⭐" label="TOTAL XP" value={xp} note={`Level ${level.level}`} />
          <StatCard icon="🏅" label="BADGES UNLOCKED" value={earned.filter((a) => a.unlocked).length} note={`of ${earned.length} milestones`} />
          <StatCard icon="🔥" label="CURRENT STREAK" value={`${streak.current} wk`} />
          <StatCard icon="🏆" label="LONGEST STREAK" value={`${streak.longest} wk`} />
        </div>

        <div className="ft-achievement-grid ft-section-gap">
          {earned.map((achievement) => (
            <div className={`ft-achievement ${achievement.unlocked ? "unlocked" : "locked"}`} key={achievement.id}>
              <div className="ft-achievement-icon">{achievement.icon}</div>
              <div>
                <strong>{achievement.name}</strong>
                <p>{achievement.description}</p>
              </div>
              <span className={`ft-achievement-status ${achievement.unlocked ? "is-unlocked" : "is-locked"}`}>{achievement.unlocked ? "UNLOCKED" : "LOCKED"}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  function ChallengesPage() {
    const challenges = [
      {
        id: "weekly",
        title: "Weekly Consistency",
        description: `Train on ${goal} distinct days this week.`,
        current: streak.thisWeekCount,
        target: goal,
        reward: 100,
      },
      {
        id: "time",
        title: "Time Under Training",
        description: "Accumulate 300 minutes of training.",
        current: Math.min(300, totalMinutes),
        target: 300,
        reward: 150,
      },
      {
        id: "entries",
        title: "Build the Habit",
        description: "Log 10 exercise entries.",
        current: Math.min(10, workouts.length),
        target: 10,
        reward: 200,
      },
    ];

    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">A LITTLE CHALLENGE</p>
            <h1>Challenges</h1>
            <p>Track progress toward personal training milestones.</p>
          </div>
        </div>

        <div className="ft-challenge-grid">
          {challenges.map((challenge) => {
            const done = challenge.current >= challenge.target;

            return (
              <section className="panel ft-challenge" key={challenge.id}>
                <div className="ft-challenge-top">
                  <span className="ft-challenge-icon">🎯</span>
                  <span className={`tag ${done ? "ft-done-tag" : ""}`}>{done ? "COMPLETED" : "IN PROGRESS"}</span>
                </div>
                <h2>{challenge.title}</h2>
                <p>{challenge.description}</p>
                <div className="ft-progress-track">
                  <div className="ft-progress-fill" style={{ width: `${Math.min(100, (challenge.current / challenge.target) * 100)}%` }} />
                </div>
                <div className="ft-challenge-meta">
                  <span className="ft-challenge-progress">{challenge.current} <i>/</i> {challenge.target}</span>
                  <span className="ft-challenge-reward"><span aria-hidden="true">✦</span> {challenge.reward} XP <small>REWARD</small></span>
                </div>
                <small className="ft-muted">Progress is calculated from your workout records.</small>
              </section>
            );
          })}
        </div>
      </>
    );
  }

  function FriendsPage() {
    const rankedFriends = [...friends].sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0));
    const rankedLeaderboard = [...leaderboard].sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0));
    return (
      <>
        <div className="page-heading">
          <div><p className="eyebrow">TRAIN TOGETHER</p><h1>Friends & Leaderboard</h1><p>Add FitTrack users and compare your progress.</p></div>
        </div>
        <section className="panel">
          <PanelHeading title="Add a friend" subtitle="Use the email address they use to sign in to FitTrack." />
          <form className="ft-friend-form" onSubmit={sendFriendRequest}>
            <input type="email" value={friendEmail} onChange={(event) => setFriendEmail(event.target.value)} placeholder="friend@example.com" required />
            <button className="primary-btn" type="submit" disabled={friendBusy}>{friendBusy ? "Sending…" : "Send request"}</button>
          </form>
          {friendError && <p className="auth-error" role="alert">{friendError}</p>}
        </section>
        {incomingRequests.length > 0 && <section className="panel ft-section-gap">
          <PanelHeading title="Friend requests" subtitle={`${incomingRequests.length} pending request${incomingRequests.length === 1 ? "" : "s"}`} />
          <div className="ft-social-list">{incomingRequests.map((request) => <div className="ft-social-row" key={request.id}><div className="profile-avatar">{String(request.senderName || "F").slice(0, 2).toUpperCase()}</div><div className="ft-social-person"><strong>{request.senderName || "FitTrack member"}</strong><small>{request.senderEmail || "Wants to connect with you"}</small></div><div className="ft-request-actions"><button className="primary-btn" onClick={() => acceptFriendRequest(request)}>Accept</button><button className="secondary-btn" onClick={() => declineFriendRequest(request)}>Decline</button></div></div>)}</div>
        </section>}
        <section className="panel ft-section-gap">
          <PanelHeading title="Your friends" subtitle="XP and workout totals update as friends use FitTrack." />
          {rankedFriends.length ? <div className="ft-social-list">{rankedFriends.map((friend, index) => <div className="ft-social-row" key={friend.uid}><span className="ft-place">#{index + 1}</span><div className="profile-avatar">{friend.avatarDataUrl ? <img src={friend.avatarDataUrl} alt="" /> : String(friend.displayName || "F").slice(0, 2).toUpperCase()}</div><div className="ft-social-person"><strong>{friend.displayName || "FitTrack member"}</strong><small>{friend.rank || "Iron"} · {friend.workouts || 0} workouts</small></div><strong className="ft-social-xp">{Number(friend.xp || 0).toLocaleString()} XP</strong></div>)}</div> : <div className="ft-empty"><span>👥</span><strong>Your friend list is empty</strong><p>Send a request using your friend's FitTrack account email.</p></div>}
        </section>
        <section className="panel ft-section-gap">
          <PanelHeading title="Global leaderboard" subtitle="Top 50 FitTrack profiles by XP. Only signed-in users with published profiles appear." />
          <div className="ft-social-list">{rankedLeaderboard.map((person, index) => <div className={`ft-social-row ${person.uid === userId ? "ft-self-row" : ""}`} key={person.uid}><span className="ft-place">#{index + 1}</span><div className="profile-avatar">{person.avatarDataUrl ? <img src={person.avatarDataUrl} alt="" /> : String(person.displayName || "F").slice(0, 2).toUpperCase()}</div><div className="ft-social-person"><strong>{person.displayName || "FitTrack member"}{person.uid === userId ? " (You)" : ""}</strong><small>{person.rank || "Iron"} · {person.workouts || 0} workouts</small></div><strong className="ft-social-xp">{Number(person.xp || 0).toLocaleString()} XP</strong></div>)}{!rankedLeaderboard.length && <p className="ft-muted">Leaderboard will appear as FitTrack users sign in.</p>}</div>
        </section>
      </>
    );
  }

  function SettingsPage() {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h1>Settings</h1>
            <p>Customize your tracker and review your data options.</p>
          </div>
        </div>

        <section className="panel">
          <PanelHeading title="Profile" subtitle="This name appears in your sidebar, friends list, and leaderboard" />
          <form
            className="ft-settings-form"
            onSubmit={(event) => {
              event.preventDefault();
              notify("Profile settings saved.");
            }}
          >
            <label>
              Display name
              <input
                value={profile.name}
                onChange={(event) => setProfile((p) => ({ ...p, name: event.target.value }))}
                placeholder="Your name"
              />
            </label>
            <label>
              Profile picture
              <input type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const image = new Image();
                  image.onload = () => {
                    const canvas = document.createElement("canvas");
                    const size = 256;
                    const scale = Math.min(size / image.width, size / image.height, 1);
                    canvas.width = Math.max(1, Math.round(image.width * scale));
                    canvas.height = Math.max(1, Math.round(image.height * scale));
                    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
                    setProfile((p) => ({ ...p, avatarDataUrl: canvas.toDataURL("image/jpeg", 0.78) }));
                    notify("Profile picture updated and will sync with your account.");
                  };
                  image.src = String(reader.result);
                };
                reader.readAsDataURL(file);
              }} />
            </label>
            <label>
              Weight unit
              <select
                value={profile.unit}
                onChange={(event) => setProfile((p) => ({ ...p, unit: event.target.value }))}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </select>
            </label>
            <label className="ft-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(profile.reminderEnabled)}
                onChange={(event) => setProfile((p) => ({ ...p, reminderEnabled: event.target.checked }))}
              />
              Enable in-app reminder preference
            </label>
            <label>
              Preferred reminder time
              <input
                type="time"
                value={profile.reminder || "18:00"}
                onChange={(event) => setProfile((p) => ({ ...p, reminder: event.target.value }))}
              />
            </label>
            <button className="primary-btn" type="submit">Save settings</button>
          </form>
          <p className="ft-muted">
            Reminder settings are saved as preferences only. This version does not send background push notifications.
          </p>
        </section>

        <section className="panel ft-section-gap">
          <PanelHeading title={`${rank.name} rank`} subtitle="Earn XP by logging workouts, meeting weekly goals, and setting exercise records." />
          <div className="ft-rank-line"><strong>{xp.toLocaleString()} XP</strong><span>{nextRank ? `${Math.max(0, nextRank.min - xp).toLocaleString()} XP to ${nextRank.name}` : "Maximum rank reached"}</span></div>
          <div className="ft-rank-track"><div className="ft-rank-fill" style={{ width: `${rankProgress}%` }} /></div>
          <div className="ft-rank-tiers">{RANKS.map((tier) => <span key={tier.name} className={tier.name === rank.name ? "active" : ""}>{tier.name}</span>)}</div>
        </section>

        <section className="panel ft-section-gap">
          <PanelHeading title="Data storage" subtitle="Workout data is saved to your signed-in Firestore account" />
          <div className="ft-summary-list">
            <div><span>Workout entries</span><strong>{workouts.length}</strong></div>
            <div><span>Body weight records</span><strong>{bodyWeights.length}</strong></div>
            <div><span>Saved drafts</span><strong>{drafts.length}</strong></div>
            <div><span>Templates</span><strong>{templates.length}</strong></div>
          </div>
          <p className="ft-muted">
            Your FitTrack document syncs through Firestore when the cloud status says Cloud synced. Local storage is kept as a migration/backup source.
          </p>
          <button
            className="secondary-btn"
            onClick={() => {
              const data = {
                workouts,
                goal,
                bodyWeights,
                drafts,
                templates,
                achievements,
                profile,
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `fittrack-backup-${today()}.json`;
              link.click();
              URL.revokeObjectURL(url);
              notify("Backup export started.");
            }}
          >
            Export backup
          </button>
        </section>

      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>FITTRACK</strong>
            <small>YOUR FITNESS JOURNAL</small>
          </div>
        </div>

        <div className="sidebar-section-label">MENU</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${tab === item.name ? "active" : ""}`}
              onClick={() => setTab(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
              {item.name === "Workouts" && <span className="nav-count">{workouts.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="profile-avatar">{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="Profile" /> : String(profile.name || "FT").slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{profile.name || "Fitness Journey"}</strong>
              <small>{rank.name} · {xp.toLocaleString()} XP</small>
            </div>
          </div>
          <div className="ft-sidebar-streak">🔥 {streak.current} week streak</div>
          <div className="ft-sidebar-rank"><div className="ft-rank-track"><div className="ft-rank-fill" style={{ width: `${rankProgress}%` }} /></div><small>{nextRank ? `${Math.max(0, nextRank.min - xp)} XP to ${nextRank.name}` : "Master rank"}</small></div>
          <small className="ft-muted" style={{ display: "block", marginTop: 8 }}>{cloudStatus}</small>
          <button className="ft-logout-btn" onClick={() => (onLogout ? onLogout() : signOut(auth))} title={`Sign out ${userEmail || "of FitTrack"}`}>↪ Log out</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-topbar">
          <div className="brand-mark">F</div>
          <strong>FITTRACK</strong>
          <button className="primary-btn" onClick={openNewWorkout}>+ Log</button>
        </div>

        <div className="page-content">
          {tab === "Dashboard" && Dashboard()}
          {tab === "Workouts" && WorkoutsPage()}
          {tab === "Exercise Progress" && ExerciseProgressPage()}
          {tab === "Progress" && ProgressPage()}
          {tab === "Habit Calendar" && CalendarPage()}
          {tab === "Achievements" && AchievementsPage()}
          {tab === "Challenges" && ChallengesPage()}
          {tab === "Settings" && SettingsPage()}
          {tab === "Friends & Leaderboard" && FriendsPage()}
        </div>
      </main>

      {message && <div className="ft-toast" role="status">{message}</div>}

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowForm(false);
        }}>
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">FITNESS JOURNAL</p>
                <h2>{editingId ? "Edit workout" : "Log a workout"}</h2>
              </div>
              <button className="close-btn" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className="ft-timer-panel">
              <div><small>WORKOUT TIMER</small><strong>{String(Math.floor(timerSeconds / 3600)).padStart(2, "0")}:{String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0")}:{String(timerSeconds % 60).padStart(2, "0")}</strong></div>
              <div className="ft-timer-actions">
                <button type="button" className="primary-btn" onClick={() => setTimerRunning((running) => !running)}>{timerRunning ? "Pause" : timerSeconds ? "Resume" : "Start"}</button>
                <button type="button" className="secondary-btn" onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}>Reset</button>
              </div>
            </div>
            <form onSubmit={saveWorkout}>
              <label>
                Exercise name
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                  placeholder="e.g. Bench Press"
                  required
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
                  required
                />
              </label>

              <div className="ft-form-grid">
                <label>
                  Sets
                  <input type="number" min="1" value={form.sets} onChange={(event) => setForm((f) => ({ ...f, sets: event.target.value }))} required />
                </label>
                <label>
                  Reps
                  <input type="number" min="1" value={form.reps} onChange={(event) => setForm((f) => ({ ...f, reps: event.target.value }))} required />
                </label>
              </div>

              <div className="ft-form-grid">
                <label>
                  Weight (kg)
                  <input type="number" min="0" step="0.5" value={form.weight} onChange={(event) => setForm((f) => ({ ...f, weight: event.target.value }))} required />
                </label>
                <label>
                  Duration (minutes)
                  <input type="number" min="0" value={form.duration} onChange={(event) => setForm((f) => ({ ...f, duration: event.target.value }))} required />
                </label>
              </div>

              <label>
                Notes (optional)
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((f) => ({ ...f, note: event.target.value }))}
                  placeholder="How did the workout go?"
                  rows="3"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={saveDraft}>Save draft</button>
                <button type="button" className="secondary-btn" onClick={saveTemplate}>Save template</button>
                <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-btn">{editingId ? "Save changes" : "Save workout"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal ft-confirm-modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">CONFIRM ACTION</p>
                <h2>Delete workout?</h2>
              </div>
            </div>
            <p>This removes the selected workout entry from your saved history.</p>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="primary-btn ft-danger-btn" onClick={() => deleteWorkout(confirmDelete)}>Delete workout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
