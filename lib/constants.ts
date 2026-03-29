// lib/constants.ts
import type { Stack, Track, Role, ChatSender } from "./types";

// ─── Stack → Track mapping ────────────────────────────

export const STACK_TO_TRACK: Record<Stack, Track> = {
  NODE_EXPRESS_PRISMA: "BACKEND",
  PYTHON_FASTAPI: "BACKEND",
  PYTHON_DJANGO: "BACKEND",
  GO_GIN: "BACKEND",
  JAVA_SPRING: "BACKEND",
  REACT_NEXTJS: "FRONTEND",
  REACT_VITE: "FRONTEND",
  VUE_NUXT: "FRONTEND",
  SVELTE_KIT: "FRONTEND",
  FULLSTACK_NEXTJS: "FULLSTACK",
  FULLSTACK_REMIX: "FULLSTACK",
  CYBER_PENTEST: "CYBERSECURITY",
  CYBER_INCIDENT_RESPONSE: "CYBERSECURITY",
  CYBER_SECURE_CODE: "CYBERSECURITY",
};

export const STACK_LABELS: Record<Stack, string> = {
  NODE_EXPRESS_PRISMA: "Node + Express + Prisma",
  PYTHON_FASTAPI: "Python + FastAPI",
  PYTHON_DJANGO: "Python + Django",
  GO_GIN: "Go + Gin",
  JAVA_SPRING: "Java + Spring",
  REACT_NEXTJS: "React + Next.js",
  REACT_VITE: "React + Vite",
  VUE_NUXT: "Vue + Nuxt",
  SVELTE_KIT: "SvelteKit",
  FULLSTACK_NEXTJS: "Fullstack Next.js",
  FULLSTACK_REMIX: "Fullstack Remix",
  CYBER_PENTEST: "Penetration Testing",
  CYBER_INCIDENT_RESPONSE: "Incident Response",
  CYBER_SECURE_CODE: "Secure Code Review",
};

export const TRACK_INFO: Record<
  Track,
  { name: string; description: string; available: boolean }
> = {
  BACKEND: {
    name: "Backend Engineering",
    description: "APIs, databases, authentication, server architecture",
    available: true,
  },
  FRONTEND: {
    name: "Frontend Engineering",
    description: "UI components, state management, responsive design",
    available: false,
  },
  FULLSTACK: {
    name: "Fullstack Engineering",
    description: "End-to-end features spanning client and server",
    available: false,
  },
  CYBERSECURITY: {
    name: "Cybersecurity",
    description: "Penetration testing, incident response, secure code review",
    available: false,
  },
};

// ─── Personas ─────────────────────────────────────────

export const PERSONA_COLORS: Record<string, string> = {
  PM: "#A29BFE",
  SARAH: "#A29BFE",
  MARCUS: "#00D2A0",
  PRIYA: "#E17055",
  JAMES: "#4ECDC4",
  SYSTEM: "#7B7990",
  CANDIDATE: "#C8C6D8",
};

export const PERSONA_NAMES: Record<string, string> = {
  PM: "Sarah Chen",
  SARAH: "Sarah Chen",
  MARCUS: "Marcus Rivera",
  PRIYA: "Priya Sharma",
  JAMES: "James Okonkwo",
  SYSTEM: "System",
  CANDIDATE: "You",
};

export const PERSONA_ROLES: Record<string, string> = {
  PM: "Project Manager",
  SARAH: "Project Manager",
  MARCUS: "Senior Backend Engineer",
  PRIYA: "Frontend Developer",
  JAMES: "DevOps Engineer",
};

export const PERSONA_INITIALS: Record<string, string> = {
  PM: "SC",
  SARAH: "SC",
  MARCUS: "MR",
  PRIYA: "PS",
  JAMES: "JO",
  SYSTEM: "DS",
};

// ─── Roles ────────────────────────────────────────────

export const ROLE_CONFIG: Record<
  Role,
  { label: string; description: string; icon: string; dashboardPath: string }
> = {
  LEARNER: {
    label: "Learner",
    description: "Practice engineering skills through realistic work simulations",
    icon: "L",
    dashboardPath: "/dashboard",
  },
  HIRING_MANAGER: {
    label: "Hiring manager",
    description: "Evaluate candidates with simulated work instead of coding tests",
    icon: "H",
    dashboardPath: "/assessments",
  },
  INSTRUCTOR: {
    label: "Instructor",
    description: "Assign simulations to students and track their progress",
    icon: "I",
    dashboardPath: "/classroom",
  },
  CANDIDATE: {
    label: "Candidate",
    description: "Taking an assessment? Enter your invite code",
    icon: "C",
    dashboardPath: "/dashboard",
  },
  ADMIN: {
    label: "Admin",
    description: "Platform administration",
    icon: "A",
    dashboardPath: "/dashboard",
  },
};

// ─── Difficulty ───────────────────────────────────────

export const DIFFICULTY_CONFIG = {
  BEGINNER: { label: "Beginner", color: "#00D2A0", bg: "rgba(0,210,160,0.12)" },
  INTERMEDIATE: { label: "Intermediate", color: "#F9A826", bg: "rgba(249,168,38,0.12)" },
  ADVANCED: { label: "Advanced", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
} as const;

// ─── Nav links per role ───────────────────────────────

export const NAV_LINKS: Record<Role, { label: string; href: string }[]> = {
  LEARNER: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Simulations", href: "/dashboard/simulations" },
    { label: "History", href: "/dashboard/history" },
    { label: "Settings", href: "/settings" },
  ],
  HIRING_MANAGER: [
    { label: "Assessments", href: "/assessments" },
    { label: "Candidates", href: "/assessments/candidates" },
    { label: "Reports", href: "/assessments/reports" },
    { label: "Settings", href: "/settings" },
  ],
  INSTRUCTOR: [
    { label: "Classroom", href: "/classroom" },
    { label: "Assignments", href: "/classroom/assignments" },
    { label: "Students", href: "/classroom/students" },
    { label: "Grades", href: "/classroom/grades" },
    { label: "Settings", href: "/settings" },
  ],
  CANDIDATE: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Settings", href: "/settings" },
  ],
  ADMIN: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Simulations", href: "/dashboard/simulations" },
    { label: "Users", href: "/admin/users" },
    { label: "Settings", href: "/settings" },
  ],
};