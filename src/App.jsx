
import { useEffect, useState } from "react";
import "./App.css";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const initialWorkouts = [
  { id: 1, date: today(), name: "Bench Press", sets: 3, reps: 10, weight: 40, note: "Chest day" },
  { id: 2, date: today(), name: "Lat Pulldown", sets: 3, reps: 12, weight: 35, note: "Back day" },
];

function readSavedData() {
  try {
    return JSON.parse(localStorage.getItem("workout-habit-data")) || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [saved] = useState(readSavedData);
  const [workouts, setWorkouts] = useState(() => saved?.workouts ?? []);
  const [goal, setGoal] = useState(() => saved?.goal ?? 4);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: today(),
    name: "",
    sets: "3",
    reps: "10",
    weight: "0",
    note: "",
  });

  useEffect(() => {
    localStorage.setItem(
      "workout-habit-data",
      JSON.stringify({ workouts, goal })
    );
  }, [workouts, goal]);

  const dateOf = (date) => new Date(`${date}T12:00:00`);

  const startOfWeek = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  };

  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const thisWeek = workouts.filter((w) => {
    const d = dateOf(w.date);
    return d >= weekStart && d < weekEnd;
  });

  const trainingDays = new Set(thisWeek.map((w) => w.date)).size;
  const completedSessions = new Set(
    workouts.map((w) => w.date)
  ).size;

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      number: d.getDate(),
    };
  });

  const bestWeight = workouts.reduce(
    (max, w) => Math.max(max, Number(w.weight) || 0),
    0
  );

  const volume = workouts.reduce(
    (sum, w) =>
      sum +
      (Number(w.sets) || 0) *
        (Number(w.reps) || 0) *
        (Number(w.weight) || 0),
    0
  );

  const sortedWorkouts = [...workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  );

  function addWorkout(e) {
    e.preventDefault();

    if (!form.name.trim()) return;

    const newWorkout = {
      ...form,
      id: Date.now(),
      sets: Math.max(1, Number(form.sets) || 1),
      reps: Math.max(1, Number(form.reps) || 1),
      weight: Math.max(0, Number(form.weight) || 0),
      name: form.name.trim(),
      note: form.note.trim(),
    };

    setWorkouts((prev) => [...prev, newWorkout]);
    setForm({
      date: today(),
      name: "",
      sets: "3",
      reps: "10",
      weight: "0",
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
    { label: "Progress", icon: "⌁" },
    { label: "Habit Calendar", icon: "▦" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={() => setActiveTab("Dashboard")}>
          <span className="brand-icon">F</span>
          <span>FIT<span className="accent">TRACK</span><small>YOUR FITNESS JOURNAL</small></span>
        </a>

        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activeTab === item.label ? "active" : ""}`}
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
              <span style={{ width: `${Math.min(100, (trainingDays / goal) * 100)}%` }} />
            </div>
            <div className="goal-foot">
              <span>{trainingDays} of {goal} days</span>
              <span>{Math.round(Math.min(100, (trainingDays / goal) * 100))}%</span>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">FT</div>
            <div><strong>Fitness Journey</strong><small>Personal tracker</small></div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {activeTab}</div>
          <div className="topbar-right">
            <span className="live-dot" /> <span className="saved-label">Auto-saved locally</span>
            <div className="avatar small-avatar">FT</div>
          </div>
        </header>

        <div className="page-content">
          {activeTab === "Dashboard" && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow"><span className="live-dot" /> YOUR PERSONAL FITNESS SPACE</div>
                  <h1>Build strength.<br /><span>Build consistency.</span></h1>
                  <p className="subtitle">Every workout counts. Keep showing up for yourself.</p>
                </div>
                <button className="primary-btn" onClick={() => setShowForm(true)}>＋ Log a workout</button>
              </section>

              <section className="stats-grid">
                <StatCard icon="↗" label="WORKOUT ENTRIES" value={workouts.length} note="Total exercise logs" />
                <StatCard icon="◷" label="ACTIVE DAYS" value={trainingDays} note="Unique days this week" />
                <StatCard icon="⌁" label="TOTAL VOLUME" value={volume.toLocaleString()} note="Weight × reps × sets" />
                <StatCard icon="✦" label="HEAVIEST WEIGHT" value={`${bestWeight} kg`} note="Highest logged exercise weight" />
              </section>

              <section className="content-grid">
                <div className="panel">
                  <div className="panel-heading">
                    <div><h2>This week</h2><p>Your consistency at a glance</p></div>
                    <span className="tag">{trainingDays}/{goal} DAYS</span>
                  </div>
                  <div className="week-grid">
                    {dates.map((d) => {
                      const done = workouts.some((w) => w.date === d.date);
                      const isToday = d.date === today();
                      return (
                        <div className={`week-day ${done ? "done" : ""}`} key={d.date}>
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
                    <select id="weekly-goal" value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
                      {[2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} days per week</option>)}
                    </select>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-heading">
                    <div><h2>Recent activity</h2><p>Your latest workout entries</p></div>
                    <button className="text-btn" onClick={() => setActiveTab("Workouts")}>View all →</button>
                  </div>
                  <WorkoutList workouts={sortedWorkouts.slice(0, 4)} onDelete={deleteWorkout} />
                </div>
              </section>

              <section className="quote-banner">
                <div className="quote-mark">“</div>
                <div><h3>Consistency beats perfection.</h3><p>You don't need a perfect workout. You just need to keep going.</p></div>
                <div className="banner-decoration">✳</div>
              </section>
            </>
          )}

          {activeTab === "Workouts" && (
            <>
              <PageHeading eyebrow="YOUR TRAINING LOG" title="Workout history" subtitle="Record your exercises and keep every session in one place.">
                <button className="primary-btn" onClick={() => setShowForm(true)}>＋ Add workout</button>
              </PageHeading>
              <div className="panel history-panel">
                <div className="panel-heading"><div><h2>All workout entries</h2><p>{workouts.length} exercise entries recorded</p></div></div>
                <WorkoutList workouts={sortedWorkouts} onDelete={deleteWorkout} />
              </div>
            </>
          )}

          {activeTab === "Progress" && (
            <>
              <PageHeading eyebrow="YOUR PERFORMANCE" title="Track your progress" subtitle="Review your training activity and recorded lifting performance." />
              <section className="stats-grid">
                <StatCard icon="↗" label="TOTAL ENTRIES" value={workouts.length} note="All logged exercises" />
                <StatCard icon="◷" label="TRAINING DAYS" value={completedSessions} note="Unique dates recorded" />
                <StatCard icon="⌁" label="TOTAL VOLUME" value={volume.toLocaleString()} note="Weight × reps × sets" />
                <StatCard icon="✦" label="BEST WEIGHT" value={`${bestWeight} kg`} note="Highest logged weight" />
              </section>
              <div className="panel progress-panel">
                <div className="panel-heading"><div><h2>Entries over the last 7 days</h2><p>Number of exercises logged each day</p></div></div>
                <div className="chart">
                  {dates.map((d) => {
                    const count = workouts.filter((w) => w.date === d.date).length;
                    const max = Math.max(1, ...dates.map((day) => workouts.filter((w) => w.date === day.date).length));
                    return (
                      <div className="chart-column" key={d.date}>
                        <strong>{count}</strong>
                        <div className="chart-track"><div className="chart-bar" style={{ height: `${count ? Math.max(8, (count / max) * 100) : 0}%` }} /></div>
                        <span>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="chart-note">Charts use your saved entries for the current Monday–Sunday week. Add workouts to see your activity change.</p>
              </div>
            </>
          )}

          {activeTab === "Habit Calendar" && (
            <>
              <PageHeading eyebrow="SHOW UP FOR YOURSELF" title="Habit calendar" subtitle="See which days you trained and keep building a sustainable routine." />
              <div className="panel calendar-panel">
                <div className="panel-heading"><div><h2>This week</h2><p>Monday through Sunday</p></div><span className="tag">{trainingDays} ACTIVE DAYS</span></div>
                <div className="calendar-grid">
                  {dates.map((d) => {
                    const done = workouts.some((w) => w.date === d.date);
                    return (
                      <div className={`calendar-day ${done ? "calendar-done" : ""}`} key={d.date}>
                        <span>{d.day}</span><strong>{d.number}</strong>
                        <div className="calendar-status">{done ? "✓" : "·"}</div>
                        <small>{done ? "Workout logged" : "Rest / no log"}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="calendar-footer"><span className="legend-dot" /> A day counts when at least one workout entry exists for that date.</div>
                <button className="primary-btn" onClick={() => setShowForm(true)}>＋ Log a workout</button>
              </div>
            </>
          )}
        </div>
      </main>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal">
            <div className="modal-heading"><div><div className="eyebrow">TRAINING JOURNAL</div><h2>Log a workout</h2></div><button className="close-btn" onClick={() => setShowForm(false)}>×</button></div>
            <form onSubmit={addWorkout}>
              <label>Exercise name<input required autoFocus placeholder="e.g. Bench Press" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Workout date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <div className="form-row">
                <label>Sets<input required type="number" min="1" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} /></label>
                <label>Reps per set<input required type="number" min="1" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} /></label>
              </div>
              <label>Weight (kg)<input required type="number" min="0" step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></label>
              <label>Notes <span className="optional">(optional)</span><textarea rows="2" placeholder="How did the workout go?" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-btn">Save workout</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, note }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, children }) {
  return <section className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{children}</section>;
}

function WorkoutList({ workouts, onDelete }) {
  if (!workouts.length) {
    return <div className="empty-state"><span>↗</span><h3>No workouts yet</h3><p>Log your first exercise to start tracking your progress.</p></div>;
  }

  return (
    <div className="workout-list">
      {workouts.map((w) => (
        <div className="workout-item" key={w.id}>
          <div className="exercise-icon">↗</div>
          <div className="exercise-details">
            <strong>{w.name}</strong>
            <span>{w.sets} sets × {w.reps} reps · {w.weight} kg</span>
            {w.note && <small>{w.note}</small>}
            <small>{w.date}</small>
          </div>
          <button className="delete-btn" title="Delete entry" onClick={() => onDelete(w.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
