
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "workout-habit-data";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dateOf = (date) => new Date(`${date}T12:00:00`);

const formatDate = (date) =>
  dateOf(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const startOfWeek = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const startOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 12);

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function readSavedData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function volumeOf(w) {
  return (Number(w.sets) || 0) *
    (Number(w.reps) || 0) *
    (Number(w.weight) || 0);
}

function uniqueDays(workouts) {
  return new Set(workouts.map((w) => w.date)).size;
}

function getWeekKey(date) {
  return dateKey(startOfWeek(dateOf(date)));
}

function getWeeklyStreak(workouts, goal) {
  if (!workouts.length) return { current: 0, longest: 0 };

  const currentWeek = startOfWeek();
  const firstWeek = startOfWeek(
    dateOf([...workouts].sort((a, b) => a.date.localeCompare(b.date))[0].date)
  );

  const weeks = [];
  for (
    let d = new Date(firstWeek);
    d <= currentWeek;
    d.setDate(d.getDate() + 7)
  ) {
    const key = dateKey(d);
    const days = new Set(
      workouts
        .filter((w) => getWeekKey(w.date) === key)
        .map((w) => w.date)
    ).size;

    weeks.push({
      key,
      days,
      successful: days >= goal,
      isCurrent: key === dateKey(currentWeek),
    });
  }

  let longest = 0;
  let run = 0;

  weeks.forEach((week) => {
    if (week.successful) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (!week.isCurrent) {
      run = 0;
    }
  });

  // The current week is still in progress. It does not break an existing
  // streak until the week ends without meeting the goal.
  let current = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const week = weeks[i];

    if (week.successful) {
      current += 1;
      continue;
    }

    if (week.isCurrent) continue;
    break;
  }

  return { current, longest };
}

function StatCard({ icon, label, value, note }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, children }) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function WorkoutList({ workouts, onDelete }) {
  if (!workouts.length) {
    return (
      <div className="empty-state">
        <span>↗</span>
        <h3>No workouts yet</h3>
        <p>Log an exercise to start tracking your progress.</p>
      </div>
    );
  }

  return (
    <div className="workout-list">
      {workouts.map((w) => (
        <div className="workout-item" key={w.id}>
          <div className="exercise-icon">↗</div>
          <div className="exercise-details">
            <strong>{w.name}</strong>
            <span>
              {w.sets} sets × {w.reps} reps · {w.weight} kg
            </span>
            {Number(w.duration) > 0 && (
              <small>{w.duration} minutes</small>
            )}
            {w.note && <small>{w.note}</small>}
            <small>{formatDate(w.date)}</small>
          </div>
          <button
            className="delete-btn"
            title="Delete workout"
            onClick={() => onDelete(w.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [saved] = useState(readSavedData);
  const [workouts, setWorkouts] = useState(() => saved?.workouts ?? []);
  const [goal, setGoal] = useState(() => saved?.goal ?? 4);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [showForm, setShowForm] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [form, setForm] = useState({
    date: today(),
    name: "",
    sets: "3",
    reps: "10",
    weight: "0",
    duration: "60",
    note: "",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ workouts, goal }));
  }, [workouts, goal]);

  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = startOfMonth();
  const nextMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1,
    12
  );

  const thisWeek = workouts.filter((w) => {
    const d = dateOf(w.date);
    return d >= weekStart && d < weekEnd;
  });

  const thisMonth = workouts.filter((w) => {
    const d = dateOf(w.date);
    return d >= monthStart && d < nextMonth;
  });

  const trainingDays = uniqueDays(thisWeek);
  const monthlyTrainingDays = uniqueDays(thisMonth);
  const totalDuration = workouts.reduce(
    (sum, w) => sum + (Number(w.duration) || 0),
    0
  );
  const weeklyDuration = thisWeek.reduce(
    (sum, w) => sum + (Number(w.duration) || 0),
    0
  );
  const monthlyDuration = thisMonth.reduce(
    (sum, w) => sum + (Number(w.duration) || 0),
    0
  );
  const volume = workouts.reduce((sum, w) => sum + volumeOf(w), 0);
  const bestWeight = workouts.reduce(
    (max, w) => Math.max(max, Number(w.weight) || 0),
    0
  );

  const streak = getWeeklyStreak(workouts, goal);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    return {
      date: key,
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      number: d.getDate(),
    };
  });

  const sortedWorkouts = useMemo(
    () =>
      [...workouts].sort(
        (a, b) => b.date.localeCompare(a.date) || b.id - a.id
      ),
    [workouts]
  );

  const exerciseNames = useMemo(
    () =>
      [...new Set(workouts.map((w) => w.name.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [workouts]
  );

  useEffect(() => {
    if (!selectedExercise && exerciseNames.length) {
      setSelectedExercise(exerciseNames[0]);
    } else if (
      selectedExercise &&
      !exerciseNames.includes(selectedExercise)
    ) {
      setSelectedExercise(exerciseNames[0] || "");
    }
  }, [exerciseNames, selectedExercise]);

  const exerciseHistory = sortedWorkouts
    .filter(
      (w) =>
        w.name.trim().toLowerCase() ===
        selectedExercise.trim().toLowerCase()
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const exercisePR = exerciseHistory.reduce(
    (best, w) => Math.max(best, Number(w.weight) || 0),
    0
  );
  const latestPerformance = exerciseHistory[exerciseHistory.length - 1];
  const previousPerformance =
    exerciseHistory.length > 1
      ? exerciseHistory[exerciseHistory.length - 2]
      : null;

  const performanceChange = previousPerformance && latestPerformance
    ? Number(latestPerformance.weight) - Number(previousPerformance.weight)
    : null;

  const weeklyEntries = dates.map((d) => ({
    ...d,
    count: thisWeek.filter((w) => w.date === d.date).length,
    minutes: thisWeek
      .filter((w) => w.date === d.date)
      .reduce((sum, w) => sum + (Number(w.duration) || 0), 0),
  }));

  const monthlyEntries = Array.from({ length: 4 }, (_, i) => {
    const start = new Date(monthStart);
    start.setDate(1 + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const entries = thisMonth.filter((w) => {
      const d = dateOf(w.date);
      return d >= start && d < end;
    });

    return {
      label: `Week ${i + 1}`,
      count: entries.length,
      days: uniqueDays(entries),
    };
  });

  function addWorkout(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const newWorkout = {
      ...form,
      id: Date.now(),
      name: form.name.trim(),
      sets: Math.max(1, Number(form.sets) || 1),
      reps: Math.max(1, Number(form.reps) || 1),
      weight: Math.max(0, Number(form.weight) || 0),
      duration: Math.max(0, Number(form.duration) || 0),
      note: form.note.trim(),
    };

    setWorkouts((prev) => [...prev, newWorkout]);
    setSelectedExercise(newWorkout.name);
    setForm({
      date: today(),
      name: "",
      sets: "3",
      reps: "10",
      weight: "0",
      duration: "60",
      note: "",
    });
    setShowForm(false);
    setActiveTab("Workouts");
  }

  function deleteWorkout(id) {
    if (window.confirm("Delete this workout entry?")) {
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
    }
  }

  const navItems = [
    { label: "Dashboard", icon: "▦" },
    { label: "Workouts", icon: "↗" },
    { label: "Exercise Progress", icon: "⌁" },
    { label: "Progress", icon: "▤" },
    { label: "Habit Calendar", icon: "▦" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dashboard"
          onClick={() => setActiveTab("Dashboard")}
        >
          <span className="brand-icon">F</span>
          <span>
            FIT<span className="accent">TRACK</span>
            <small>YOUR FITNESS JOURNAL</small>
          </span>
        </a>

        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${
                activeTab === item.label ? "active" : ""
              }`}
              onClick={() => setActiveTab(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.label === "Workouts" && (
                <span className="nav-count">{workouts.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="goal-card">
            <div className="goal-symbol">✦</div>
            <h3>Your weekly goal</h3>
            <p>Small steps. Strong habits.</p>
            <div className="goal-progress">
              <span
                style={{
                  width: `${Math.min(100, (trainingDays / goal) * 100)}%`,
                }}
              />
            </div>
            <div className="goal-foot">
              <span>
                {trainingDays} of {goal} days
              </span>
              <span>
                {Math.round(Math.min(100, (trainingDays / goal) * 100))}%
              </span>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">FT</div>
            <div>
              <strong>Fitness Journey</strong>
              <small>Personal tracker</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activeTab}
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            <span className="saved-label">Auto-saved locally</span>
            <div className="avatar small-avatar">FT</div>
          </div>
        </header>

        <div className="page-content">
          {activeTab === "Dashboard" && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <span className="live-dot" /> YOUR PERSONAL FITNESS SPACE
                  </div>
                  <h1>
                    Build strength.
                    <br />
                    <span>Build consistency.</span>
                  </h1>
                  <p className="subtitle">
                    Every workout counts. Keep showing up for yourself.
                  </p>
                </div>
                <button
                  className="primary-btn"
                  onClick={() => setShowForm(true)}
                >
                  ＋ Log a workout
                </button>
              </section>

              <section className="stats-grid">
                <StatCard
                  icon="↗"
                  label="TOTAL WORKOUTS"
                  value={workouts.length}
                  note="All exercise entries"
                />
                <StatCard
                  icon="◷"
                  label="TRAINING TIME"
                  value={`${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`}
                  note="From entries with duration"
                />
                <StatCard
                  icon="🔥"
                  label="WEEKLY STREAK"
                  value={`${streak.current} weeks`}
                  note={`Longest: ${streak.longest} weeks`}
                />
                <StatCard
                  icon="✦"
                  label="PERSONAL RECORD"
                  value={`${bestWeight} kg`}
                  note="Heaviest recorded exercise"
                />
              </section>

              <section className="content-grid">
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>This week</h2>
                      <p>Your consistency at a glance</p>
                    </div>
                    <span className="tag">
                      {trainingDays}/{goal} DAYS
                    </span>
                  </div>

                  <div className="week-grid">
                    {dates.map((d) => {
                      const done = workouts.some((w) => w.date === d.date);
                      const isToday = d.date === today();
                      return (
                        <div
                          className={`week-day ${done ? "done" : ""}`}
                          key={d.date}
                        >
                          <span>{d.day}</span>
                          <div className={`day-circle ${isToday ? "today" : ""}`}>
                            {done ? "✓" : d.number}
                          </div>
                          <small>{done ? "DONE" : isToday ? "TODAY" : "—"}</small>
                        </div>
                      );
                    })}
                  </div>

                  <div className="goal-editor">
                    <label htmlFor="weekly-goal">Weekly workout goal</label>
                    <select
                      id="weekly-goal"
                      value={goal}
                      onChange={(e) => setGoal(Number(e.target.value))}
                    >
                      {[2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n} days per week
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="chart-note">
                    A week counts toward your streak when you reach your goal.
                    Rest days are fine; only different workout dates count.
                  </p>
                </div>

                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent activity</h2>
                      <p>Your latest workout entries</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setActiveTab("Workouts")}
                    >
                      View all →
                    </button>
                  </div>
                  <WorkoutList
                    workouts={sortedWorkouts.slice(0, 4)}
                    onDelete={deleteWorkout}
                  />
                </div>
              </section>

              <section className="stats-grid">
                <StatCard
                  icon="▤"
                  label="THIS WEEK"
                  value={thisWeek.length}
                  note={`${trainingDays} active training days`}
                />
                <StatCard
                  icon="◷"
                  label="WEEKLY TIME"
                  value={`${weeklyDuration} min`}
                  note="Logged training duration"
                />
                <StatCard
                  icon="▦"
                  label="THIS MONTH"
                  value={thisMonth.length}
                  note={`${monthlyTrainingDays} active days`}
                />
                <StatCard
                  icon="◷"
                  label="MONTHLY TIME"
                  value={`${monthlyDuration} min`}
                  note="Logged training duration"
                />
              </section>

              <div className="panel progress-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Weekly workout activity</h2>
                    <p>Exercise entries logged each day</p>
                  </div>
                </div>
                <div className="chart">
                  {weeklyEntries.map((d) => {
                    const max = Math.max(
                      1,
                      ...weeklyEntries.map((item) => item.count)
                    );
                    return (
                      <div className="chart-column" key={d.date}>
                        <strong>{d.count}</strong>
                        <div className="chart-track">
                          <div
                            className="chart-bar"
                            style={{
                              height: `${d.count ? Math.max(8, (d.count / max) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Monthly summary</h2>
                    <p>Workout entries grouped into weeks of this month</p>
                  </div>
                </div>
                <div className="workout-list">
                  {monthlyEntries.map((item) => (
                    <div className="workout-item" key={item.label}>
                      <div className="exercise-icon">▤</div>
                      <div className="exercise-details">
                        <strong>{item.label}</strong>
                        <span>{item.count} exercise entries</span>
                        <small>{item.days} active training days</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "Workouts" && (
            <>
              <PageHeading
                eyebrow="YOUR TRAINING LOG"
                title="Workout history"
                subtitle="Record exercises, training time, and lifting performance."
              >
                <button
                  className="primary-btn"
                  onClick={() => setShowForm(true)}
                >
                  ＋ Add workout
                </button>
              </PageHeading>
              <div className="panel history-panel">
                <div className="panel-heading">
                  <div>
                    <h2>All workout entries</h2>
                    <p>{workouts.length} exercise entries recorded</p>
                  </div>
                </div>
                <WorkoutList
                  workouts={sortedWorkouts}
                  onDelete={deleteWorkout}
                />
              </div>
            </>
          )}

          {activeTab === "Exercise Progress" && (
            <>
              <PageHeading
                eyebrow="LIFTING PERFORMANCE"
                title="Exercise progress"
                subtitle="Compare your performances and track personal records for each exercise."
              >
                <button
                  className="primary-btn"
                  onClick={() => setShowForm(true)}
                >
                  ＋ Log exercise
                </button>
              </PageHeading>

              {!exerciseNames.length ? (
                <div className="panel empty-state">
                  <span>⌁</span>
                  <h3>No exercise data yet</h3>
                  <p>
                    Log an exercise such as Bench Press or Squat to start
                    tracking its performance over time.
                  </p>
                </div>
              ) : (
                <>
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Select an exercise</h2>
                        <p>Choose an exercise to view its history</p>
                      </div>
                    </div>
                    <div className="goal-editor">
                      <label htmlFor="exercise-select">Exercise</label>
                      <select
                        id="exercise-select"
                        value={selectedExercise}
                        onChange={(e) => setSelectedExercise(e.target.value)}
                      >
                        {exerciseNames.map((name) => (
                          <option value={name} key={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <section className="stats-grid">
                    <StatCard
                      icon="🏆"
                      label="PERSONAL RECORD"
                      value={`${exercisePR} kg`}
                      note={selectedExercise}
                    />
                    <StatCard
                      icon="↗"
                      label="LATEST WEIGHT"
                      value={`${latestPerformance?.weight ?? 0} kg`}
                      note={
                        latestPerformance
                          ? formatDate(latestPerformance.date)
                          : "No data"
                      }
                    />
                    <StatCard
                      icon="▤"
                      label="LATEST SETS × REPS"
                      value={
                        latestPerformance
                          ? `${latestPerformance.sets} × ${latestPerformance.reps}`
                          : "—"
                      }
                      note="Latest logged performance"
                    />
                    <StatCard
                      icon="⌁"
                      label="CHANGE FROM PREVIOUS"
                      value={
                        performanceChange === null
                          ? "—"
                          : `${performanceChange > 0 ? "+" : ""}${performanceChange} kg`
                      }
                      note={
                        performanceChange === null
                          ? "Log this exercise twice to compare"
                          : "Latest weight vs. previous entry"
                      }
                    />
                  </section>

                  <div className="panel progress-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>{selectedExercise} weight history</h2>
                        <p>Recorded weight per workout, in kilograms</p>
                      </div>
                    </div>

                    <div className="chart">
                      {exerciseHistory.slice(-10).map((w, i, arr) => {
                        const max = Math.max(
                          1,
                          ...arr.map((item) => Number(item.weight) || 0)
                        );
                        return (
                          <div className="chart-column" key={w.id}>
                            <strong>{w.weight}</strong>
                            <div className="chart-track">
                              <div
                                className="chart-bar"
                                style={{
                                  height: `${Math.max(5, ((Number(w.weight) || 0) / max) * 100)}%`,
                                }}
                              />
                            </div>
                            <span>
                              {dateOf(w.date).toLocaleDateString("en-US", {
                                month: "numeric",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="chart-note">
                      Showing up to the last 10 logged entries. The chart uses
                      the weights you recorded; it doesn't estimate unlogged
                      lifts.
                    </p>
                  </div>

                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Performance history</h2>
                        <p>Compare your past sets, reps, and weights</p>
                      </div>
                    </div>
                    <WorkoutList
                      workouts={[...exerciseHistory].reverse()}
                      onDelete={deleteWorkout}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === "Progress" && (
            <>
              <PageHeading
                eyebrow="YOUR PERFORMANCE"
                title="Overall progress"
                subtitle="Review your workout volume, training days, and activity."
              />
              <section className="stats-grid">
                <StatCard
                  icon="↗"
                  label="TOTAL ENTRIES"
                  value={workouts.length}
                  note="All logged exercises"
                />
                <StatCard
                  icon="◷"
                  label="TRAINING DAYS"
                  value={uniqueDays(workouts)}
                  note="Unique dates recorded"
                />
                <StatCard
                  icon="⌁"
                  label="TOTAL VOLUME"
                  value={volume.toLocaleString()}
                  note="Weight × reps × sets"
                />
                <StatCard
                  icon="✦"
                  label="BEST WEIGHT"
                  value={`${bestWeight} kg`}
                  note="Highest recorded weight"
                />
              </section>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Exercises you have tracked</h2>
                    <p>Open Exercise Progress to inspect each lift</p>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => setActiveTab("Exercise Progress")}
                  >
                    View exercise progress →
                  </button>
                </div>
                <div className="workout-list">
                  {exerciseNames.length ? (
                    exerciseNames.map((name) => {
                      const history = workouts.filter(
                        (w) =>
                          w.name.trim().toLowerCase() === name.toLowerCase()
                      );
                      const record = Math.max(
                        ...history.map((w) => Number(w.weight) || 0)
                      );
                      return (
                        <div className="workout-item" key={name}>
                          <div className="exercise-icon">↗</div>
                          <div className="exercise-details">
                            <strong>{name}</strong>
                            <span>{history.length} logged entries</span>
                            <small>Personal record: {record} kg</small>
                          </div>
                          <button
                            className="text-btn"
                            onClick={() => {
                              setSelectedExercise(name);
                              setActiveTab("Exercise Progress");
                            }}
                          >
                            View →
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p>No exercises recorded yet.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "Habit Calendar" && (
            <>
              <PageHeading
                eyebrow="SHOW UP FOR YOURSELF"
                title="Habit calendar"
                subtitle="See which days you trained and keep building a sustainable routine."
              />
              <div className="panel calendar-panel">
                <div className="panel-heading">
                  <div>
                    <h2>This week</h2>
                    <p>Monday through Sunday</p>
                  </div>
                  <span className="tag">{trainingDays} ACTIVE DAYS</span>
                </div>
                <div className="calendar-grid">
                  {dates.map((d) => {
                    const done = workouts.some((w) => w.date === d.date);
                    return (
                      <div
                        className={`calendar-day ${done ? "calendar-done" : ""}`}
                        key={d.date}
                      >
                        <span>{d.day}</span>
                        <strong>{d.number}</strong>
                        <div className="calendar-status">
                          {done ? "✓" : "·"}
                        </div>
                        <small>{done ? "Workout logged" : "Rest / no log"}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="calendar-footer">
                  <span className="legend-dot" /> A day counts when at least
                  one workout entry exists for that date.
                </div>
                <button
                  className="primary-btn"
                  onClick={() => setShowForm(true)}
                >
                  ＋ Log a workout
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="modal">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">TRAINING JOURNAL</div>
                <h2>Log a workout</h2>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={addWorkout}>
              <label>
                Exercise name
                <input
                  required
                  autoFocus
                  placeholder="e.g. Bench Press"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </label>
              <label>
                Workout date
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm({ ...form, date: e.target.value })
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Sets
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.sets}
                    onChange={(e) =>
                      setForm({ ...form, sets: e.target.value })
                    }
                  />
                </label>
                <label>
                  Reps per set
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.reps}
                    onChange={(e) =>
                      setForm({ ...form, reps: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Weight (kg)
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.weight}
                    onChange={(e) =>
                      setForm({ ...form, weight: e.target.value })
                    }
                  />
                </label>
                <label>
                  Duration (minutes)
                  <input
                    type="number"
                    min="0"
                    value={form.duration}
                    onChange={(e) =>
                      setForm({ ...form, duration: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Notes <span className="optional">(optional)</span>
                <textarea
                  rows="2"
                  placeholder="How did the workout go?"
                  value={form.note}
                  onChange={(e) =>
                    setForm({ ...form, note: e.target.value })
                  }
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save workout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
