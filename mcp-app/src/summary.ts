export interface TimeEntryRow {
  started_at: string;
  ended_at: string | null;
  profiles: { email: string; full_name: string | null } | null;
  projects: { name: string } | null;
}

export interface PersonSlice {
  email: string;
  name: string;
  hours: number;
  color: string;
}

export interface ProjectBar {
  project: string;
  total: number;
  slices: PersonSlice[];
}

export interface ActiveTimer {
  name: string;
  project: string;
  startedAt: string;
}

export interface DashboardData {
  windowStartIso: string;
  teamHours: number;
  people: PersonSlice[];
  projects: ProjectBar[];
  activeTimers: ActiveTimer[];
}

export const PERSON_COLORS = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#e34948",
  "#4a3aa7",
];

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function displayName(profile: { email: string; full_name: string | null }): string {
  if (profile.full_name && profile.full_name.length > 0) return profile.full_name;
  return profile.email.split("@")[0];
}

export function buildDashboardSummary(
  rows: TimeEntryRow[],
  now: Date,
): DashboardData {
  const windowStart = new Date(now.getTime() - WEEK_MS);

  const valid = rows.filter(
    (r) =>
      r.profiles !== null &&
      r.projects !== null &&
      new Date(r.started_at).getTime() >= windowStart.getTime(),
  );

  const activeTimers: ActiveTimer[] = [];
  const hoursByPerson = new Map<string, { name: string; hours: number }>();
  const hoursByProject = new Map<string, Map<string, { name: string; hours: number }>>();

  for (const r of valid) {
    const profile = r.profiles!;
    const project = r.projects!.name;

    if (r.ended_at === null) {
      activeTimers.push({
        name: displayName(profile),
        project,
        startedAt: r.started_at,
      });
      continue;
    }

    const hours =
      (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) /
      3_600_000;

    const person = hoursByPerson.get(profile.email) ?? {
      name: displayName(profile),
      hours: 0,
    };
    person.hours += hours;
    hoursByPerson.set(profile.email, person);

    const projectMap = hoursByProject.get(project) ?? new Map();
    const slice = projectMap.get(profile.email) ?? {
      name: displayName(profile),
      hours: 0,
    };
    slice.hours += hours;
    projectMap.set(profile.email, slice);
    hoursByProject.set(project, projectMap);
  }

  // Colors are assigned only to people who have counted (completed) hours,
  // i.e. those who end up in hoursByPerson. A running-timer-only person
  // shows up in activeTimers and never consumes a color slot.
  const emails = [...hoursByPerson.keys()].sort();
  const colorByEmail = new Map(
    emails.map((email, i) => [email, PERSON_COLORS[i % PERSON_COLORS.length]]),
  );

  const people: PersonSlice[] = [...hoursByPerson.entries()]
    .map(([email, p]) => ({
      email,
      name: p.name,
      hours: round2(p.hours),
      color: colorByEmail.get(email)!,
    }))
    .sort((a, b) => b.hours - a.hours || a.email.localeCompare(b.email));

  const projects: ProjectBar[] = [...hoursByProject.entries()]
    .map(([project, sliceMap]) => {
      const slices: PersonSlice[] = [...sliceMap.entries()]
        .map(([email, s]) => ({
          email,
          name: s.name,
          hours: round2(s.hours),
          color: colorByEmail.get(email)!,
        }))
        .sort((a, b) => b.hours - a.hours || a.email.localeCompare(b.email));
      // Sum raw (unrounded) hours per project/team so totals don't drift
      // from adding up already-rounded per-slice/per-person display values.
      const rawTotal = [...sliceMap.values()].reduce((sum, s) => sum + s.hours, 0);
      return {
        project,
        total: round2(rawTotal),
        slices,
      };
    })
    .sort((a, b) => b.total - a.total || a.project.localeCompare(b.project));

  const rawTeamHours = [...hoursByPerson.values()].reduce((sum, p) => sum + p.hours, 0);

  return {
    windowStartIso: windowStart.toISOString(),
    teamHours: round2(rawTeamHours),
    people,
    projects,
    activeTimers,
  };
}
