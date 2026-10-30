# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students**: FPT University programming students taking courses (PRF192, PRO192, DSA201, etc.). They submit code solutions in ZIP archives, get immediate deterministic test execution feedback, view AI semantic code reviews and compiler explanations, participate in group project teams with Git tracking, and submit grade appeals within 48 hours.
- **Lecturers**: Course instructors managing classes, rosters, and programming exams. They configure test cases (public/hidden) and rubrics, generate assignments using GenAI, monitor automated grading pipelines, inspect structural plagiarism reports (AST/Winnowing heatmaps and side-by-side token diffs), track student Git teamwork contributions, and resolve grade appeals.
- **System Administrators**: Technical administrators managing user accounts and roles, monitoring system health, and administering the AI API Key Rotation pool (Gemini & OpenAI keys, quotas, and cooldowns).

## Product Purpose

AITA-Intelligent (AI-Powered Teaching Assistant & AST Code Analytics Platform) is an academic evaluation platform built for programming education. It automates deterministic grading through isolated Docker sandboxes, provides qualitative GenAI review against defined rubrics, detects structural code plagiarism using Abstract Syntax Tree (AST) tokenization and Winnowing fingerprinting, and quantifies Git teamwork contributions for transparent, auditable grading.

## Positioning

Unlike conventional online judges or generic LMS tools, AITA integrates:
1. Deterministic isolated sandbox grading with strict CPU/memory limits.
2. Structure-aware AST tokenization and Winnowing similarity analysis that exposes structural plagiarism across renamed variables and reorganized statements.
3. Multi-model GenAI integration with dynamic key rotation and fallback for qualitative semantic review and natural-language compilation error explanations.
4. GitHub-integrated teamwork analytics that adjust personal scores based on verified commit history, LOC deltas, and merged pull requests (C_i metric).
5. A formal, auditable 48-hour grade appeal workflow with historical score override trails.

## Operating Context

- Used in academic programming courses across lab sessions, midterms, finals, and group projects.
- Web browser interface accessible on desktop and laptop screens with role-based routing (`/student`, `/lecturer`, `/admin`).
- High-stakes evaluation environment where integrity, reproducibility, and auditability are critical: all grade overrides, submissions, and key rotations are logged.

## Capabilities and Constraints

- **Submission intake**: Single or multiple attempts, ZIP archive intake with SHA-256 hash validation and duplicate rejection.
- **Execution sandbox**: Isolated Docker execution containers for supported languages (Python, Java, C/C++), enforcing timeout and memory bounds.
- **Plagiarism analysis**: Tree-sitter AST parser, k-gram Winnowing fingerprinting, containment similarity matrix, side-by-side matched tokens view.
- **AI services**: Round-robin API key rotation pool with 24-hour rate-limit cooldown and automated fallback to local intelligence.
- **Team analytics**: GitHub repo synchronization, author mapping, contribution metric shares (commits, LOC, merged PRs), personal score factor.
- **Appeals**: 48-hour appeal window from result publication; role-enforced appeal authority (individual vs. team leader).
- **Technical constraints**: Phase 1 scope is Web App only; React Native Mobile App is deferred. No peer-to-peer student grading.

## Brand Commitments

- **Name**: AITA-Intelligent (AITA Platform).
- **Institution**: FPT University.
- **Design Tokens**: Standardized in `DESIGN.md` (Primary `#2563EB`, Background `#F8FAFC`, Surface `#FFFFFF`, Inter typography, semantic alert badges).
- **Voice**: Academic, objective, authoritative, constructive, transparent, and distraction-free.

## Evidence on Hand

- Documented requirements baseline: `document/AITA_Intelligent_SRS_Group5.md` (24 approved use cases UC01–UC24).
- Production-ready database schema: `apps/backend/prisma/schema.prisma`.
- Full-stack codebase: React/TypeScript frontend (`apps/frontend`), Express/TypeScript backend (`apps/backend`).
- Comprehensive seed data: `apps/backend/scripts/seed-demo-data.cjs` with realistic lecturers, students, classes, exams, submissions, appeals, and team contributions.

## Product Principles

1. **Academic Trust and Transparency**: Every score, test result, AI review criterion, and plagiarism percentage must provide traceable evidence and audit trails.
2. **Deterministic Fairness**: Code execution is isolated and bounded; test results are reproducible and unaffected by outside network conditions.
3. **Actionable Feedback**: When code fails or compilation errors occur, diagnostic feedback and AI explanations give students direct paths to learning and improvement.
4. **Information Density without Clutter**: High-volume tabular and diagnostic information (test cases, AST matrices, diff viewers, commit logs) must be clearly structured and scannable.
5. **Role-Enforced Privacy**: Strict role-based boundaries ensure students only see authorized individual and team data, while lecturers and admins have scoped supervisory control.

## Accessibility & Inclusion

- Adherence to WCAG 2.1 AA standards for color contrast across dark and light surfaces.
- Accessible form controls with explicit labels, focus outlines, and keyboard navigability.
- Clear status indicators that do not rely exclusively on color (combining icons, badges, and textual labels).
