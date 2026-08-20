// Leaderboard — data is fetched from MongoDB via server functions.
import { getAllUsersRemote, type UserRecord } from "./storage";

export interface LeaderEntry {
  name: string;
  contact: string;
  total: number;
  category: string;
  when: string;
}

const SAMPLE_DAILY: LeaderEntry[] = [
  {
    name: "Aarav S.",
    contact: "+971•••2341",
    total: 278,
    category: "Peak Performer",
    when: "2h ago",
  },
  {
    name: "Layla M.",
    contact: "+971•••8812",
    total: 264,
    category: "Peak Performer",
    when: "3h ago",
  },
  {
    name: "Omar K.",
    contact: "+971•••4509",
    total: 251,
    category: "Peak Performer",
    when: "4h ago",
  },
  { name: "Priya R.", contact: "+971•••7720", total: 233, category: "High Energy", when: "5h ago" },
  {
    name: "Hassan A.",
    contact: "+971•••1198",
    total: 219,
    category: "High Energy",
    when: "6h ago",
  },
  { name: "Sara T.", contact: "+971•••3344", total: 208, category: "High Energy", when: "7h ago" },
  { name: "Bilal N.", contact: "+971•••9921", total: 197, category: "High Energy", when: "8h ago" },
  { name: "Mira J.", contact: "+971•••5567", total: 188, category: "Steady Spark", when: "9h ago" },
  {
    name: "Yousef D.",
    contact: "+971•••2210",
    total: 176,
    category: "Steady Spark",
    when: "10h ago",
  },
  {
    name: "Lina F.",
    contact: "+971•••6634",
    total: 168,
    category: "Steady Spark",
    when: "11h ago",
  },
];

const SAMPLE_GLOBAL: LeaderEntry[] = [
  {
    name: "Zayd Al-Farsi",
    contact: "Dubai",
    total: 297,
    category: "Peak Performer",
    when: "All-time",
  },
  {
    name: "Noor Ibrahim",
    contact: "Abu Dhabi",
    total: 291,
    category: "Peak Performer",
    when: "All-time",
  },
  {
    name: "Riya Sharma",
    contact: "Sharjah",
    total: 285,
    category: "Peak Performer",
    when: "All-time",
  },
  { name: "Khalid M.", contact: "Ajman", total: 274, category: "Peak Performer", when: "All-time" },
  { name: "Fatima H.", contact: "Dubai", total: 270, category: "Peak Performer", when: "All-time" },
  { name: "Imran B.", contact: "Dubai", total: 263, category: "Peak Performer", when: "All-time" },
  {
    name: "Hala S.",
    contact: "Abu Dhabi",
    total: 258,
    category: "Peak Performer",
    when: "All-time",
  },
  {
    name: "Tariq W.",
    contact: "Sharjah",
    total: 249,
    category: "Peak Performer",
    when: "All-time",
  },
  { name: "Maya R.", contact: "Dubai", total: 241, category: "Peak Performer", when: "All-time" },
  {
    name: "Adel K.",
    contact: "Ras Al Khaimah",
    total: 235,
    category: "Peak Performer",
    when: "All-time",
  },
];

const mask = (c: string) => {
  if (c.includes("@")) {
    const [a, b] = c.split("@");
    return a.slice(0, 2) + "•••@" + b;
  }
  if (c.length > 4) return c.slice(0, 3) + "•••" + c.slice(-2);
  return c;
};

const fromUser = (u: UserRecord, when: string): LeaderEntry => ({
  name: u.name || "Player",
  contact: mask(u.contact),
  total: u.total,
  category: u.category,
  when,
});

export const getDailyLeaderboard = async (): Promise<LeaderEntry[]> => {
  const users = (await getAllUsersRemote()).map((u) => fromUser(u, "Today"));
  return [...users, ...SAMPLE_DAILY].sort((a, b) => b.total - a.total).slice(0, 10);
};

export const getGlobalLeaderboard = async (): Promise<LeaderEntry[]> => {
  try {
    const { getGlobalLeaderboardFn } = await import("@/server/adminFns");
    const entries = await getGlobalLeaderboardFn();
    if (entries.length > 0) return entries;
  } catch {
    // fall through to sample data
  }
  return SAMPLE_GLOBAL;
};
