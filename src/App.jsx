
import { useEffect, useMemo, useState } from "react";
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

function readStoredData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const extra = JSON.parse(localStorage.getItem(EXTRA_KEY) || "{}");

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

function getLevel(xp) {
  const level = Math.floor(xp / 250) + 1;
  const withinLevel = xp % 250;
  return { level, withinLevel, next: 250 };
}

function App() {
  const initial = useMemo(() => readStoredData(), []);

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

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ workouts, goal })
    );
  }, [workouts, goal]);

  useEffect(() => {
    localStorage.setItem(
      EXTRA_KEY,
      JSON.stringify({
        bodyWeights,
        drafts,
        templates,
        achievements,
        profile,
      })
    );
  }, [bodyWeights, drafts, templates, achievements, profile]);

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

  const xp = workouts.reduce(
    (total, w) => total + 25 + (Number(w.duration) >= 30 ? 5 : 0),
    0
  );

  const level = getLevel(xp);

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
      duration: Math.max(0, Number(form.duration) || 0),
      note: form.note.trim(),
    };

    if (editingId) {
      setWorkouts((previous) =>
        previous.map((w) => (w.id === editingId ? item : w))
      );
      notify("Workout updated.");
    } else {
      setWorkouts((previous) => [...previous, item]);
      notify("Workout saved! +25 XP");
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
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

        <section className="panel ft-section-gap">
          <PanelHeading title="Your level" subtitle="Earn XP by logging real workout entries" />
          <div className="ft-level-row">
            <div className="ft-level-icon">⭐</div>
            <div className="ft-level-main">
              <strong>Level {level.level}</strong>
              <p>{xp} total XP · {level.next - level.withinLevel} XP to next level</p>
              <div className="ft-progress-track">
                <div
                  className="ft-progress-fill"
                  style={{ width: `${(level.withinLevel / level.next) * 100}%` }}
                />
              </div>
            </div>
          </div>
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
                    <button className="delete-btn" onClick={() => setBodyWeights((previous) => previous.filter((item) => item.id !== w.id))}>×</button>
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
            <div className="ft-table">
              {exerciseNames.map((name) => {
                const history = workouts.filter((w) => w.name === name);
                const best = Math.max(0, ...history.map((w) => Number(w.weight || 0)));
                const latest = [...history].sort((a, b) => dateObject(b.date) - dateObject(a.date))[0];

                return (
                  <div className="ft-table-row" key={name}>
                    <div><strong>{name}</strong><small>{history.length} entries · latest {formatDate(latest.date)}</small></div>
                    <strong>{best} kg PR</strong>
                  </div>
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
              <span>{achievement.unlocked ? "UNLOCKED" : "LOCKED"}</span>
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
                  <span>{challenge.current} / {challenge.target}</span>
                  <strong>{challenge.reward} XP reward</strong>
                </div>
                <small className="ft-muted">Progress is calculated from your workout records.</small>
              </section>
            );
          })}
        </div>
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
          <PanelHeading title="Profile" subtitle="This name is displayed in your FitTrack sidebar" />
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
          <PanelHeading title="Data storage" subtitle="Workout data is saved in this browser in this version" />
          <div className="ft-summary-list">
            <div><span>Workout entries</span><strong>{workouts.length}</strong></div>
            <div><span>Body weight records</span><strong>{bodyWeights.length}</strong></div>
            <div><span>Saved drafts</span><strong>{drafts.length}</strong></div>
            <div><span>Templates</span><strong>{templates.length}</strong></div>
          </div>
          <p className="ft-muted">
            Clearing browser storage or using a different browser can affect locally saved data. Firebase cloud synchronization is not implemented by this App.jsx replacement.
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

        <section className="panel ft-section-gap">
          <PanelHeading title="Session" subtitle="Account sign-out is handled by your existing authentication gate" />
          <p className="ft-muted">
            Use your existing account controls to sign out. Signing out should not delete saved workout data.
          </p>
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
            <div className="profile-avatar">FT</div>
            <div>
              <strong>{profile.name || "Fitness Journey"}</strong>
              <small>Level {level.level} · {xp} XP</small>
            </div>
          </div>
          <div className="ft-sidebar-streak">🔥 {streak.current} week streak</div>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-topbar">
          <div className="brand-mark">F</div>
          <strong>FITTRACK</strong>
          <button className="primary-btn" onClick={openNewWorkout}>+ Log</button>
        </div>

        <div className="page-content">
          {tab === "Dashboard" && <Dashboard />}
          {tab === "Workouts" && <WorkoutsPage />}
          {tab === "Exercise Progress" && <ExerciseProgressPage />}
          {tab === "Progress" && <ProgressPage />}
          {tab === "Habit Calendar" && <CalendarPage />}
          {tab === "Achievements" && <AchievementsPage />}
          {tab === "Challenges" && <ChallengesPage />}
          {tab === "Settings" && <SettingsPage />}
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
