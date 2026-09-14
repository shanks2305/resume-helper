import type { JdKeywords } from "@/lib/schemas";

export type RoleTemplate = {
  id: string;
  label: string;
  blurb: string;
  keywords: JdKeywords;
  sampleJdSnippet: string;
};

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "swe",
    label: "Software Engineer",
    blurb: "Backend / fullstack product engineering",
    keywords: {
      required: ["TypeScript", "React", "Node.js", "APIs", "SQL"],
      preferred: ["System design", "CI/CD", "Testing"],
      tools: ["Git", "AWS", "Docker", "PostgreSQL"],
      titles: ["Software Engineer", "Full Stack Engineer"],
      softSkills: ["Collaboration", "Ownership"],
    },
    sampleJdSnippet:
      "We're hiring a Software Engineer to build product features in TypeScript/React and Node.js APIs, with PostgreSQL, Docker, and CI/CD.",
  },
  {
    id: "pm",
    label: "Product Manager",
    blurb: "Roadmaps, discovery, delivery",
    keywords: {
      required: ["Product roadmap", "User research", "Prioritization", "Metrics"],
      preferred: ["A/B testing", "SQL", "Go-to-market"],
      tools: ["Jira", "Figma", "Amplitude"],
      titles: ["Product Manager", "Technical Product Manager"],
      softSkills: ["Stakeholder management", "Communication"],
    },
    sampleJdSnippet:
      "Product Manager to own roadmap, run discovery, prioritize outcomes with metrics, and partner with design/engineering.",
  },
  {
    id: "data",
    label: "Data / ML",
    blurb: "Analytics, pipelines, ML systems",
    keywords: {
      required: ["Python", "SQL", "Data modeling", "ETL"],
      preferred: ["Machine Learning", "Spark", "Experimentation"],
      tools: ["dbt", "Airflow", "BigQuery", "Pandas"],
      titles: ["Data Engineer", "ML Engineer", "Data Scientist"],
      softSkills: ["Storytelling", "Cross-functional collaboration"],
    },
    sampleJdSnippet:
      "Data role focused on Python/SQL pipelines, modeling, and trustworthy metrics. Nice to have ML, Spark, Airflow/dbt.",
  },
];

export const SAMPLE_JD = `Software Engineer, Platform

About the role
We are looking for a Software Engineer with 4+ years of experience building reliable backend and fullstack services.

Requirements
- Strong TypeScript and Node.js
- React for internal tools
- PostgreSQL and REST API design
- Experience with Docker and CI/CD
- Cloud experience (AWS preferred)

Nice to have
- Kubernetes
- GraphQL
- Observability (OpenTelemetry, Datadog)

Responsibilities
- Design and ship APIs used by product teams
- Improve reliability, latency, and developer experience
- Collaborate with senior engineers on system design

Benefits
- Health insurance and 401k
- Unlimited PTO

Equal Opportunity Employer
All qualified applicants will receive consideration without regard to race, color, religion...`;

export const SAMPLE_RESUME = `Alex Rivera
alex.rivera@email.com | (555) 010-2040 | linkedin.com/in/alexrivera

Summary
Full-stack engineer focused on TypeScript services and product-facing APIs.

Experience
Software Engineer — Northwind Labs (2021 – Present)
- Built Node.js/TypeScript APIs serving checkout and billing workflows
- Shipped React admin tools used by operations daily
- Reduced p95 API latency with query tuning in PostgreSQL
- Added CI pipelines and Dockerized services for staging

Junior Developer — Contoso (2019 – 2021)
- Maintained REST services and wrote integration tests
- Collaborated with product on feature delivery

Skills
TypeScript, JavaScript, Node.js, React, PostgreSQL, Docker, Git, AWS basics

Education
B.S. Computer Science — State University
`;
