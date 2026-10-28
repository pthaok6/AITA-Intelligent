
---
name: AITA
description: Design system for an AI-powered programming education platform.
colors:
  primary: "#2563EB"
  secondary: "#475569"
  background: "#F8FAFC"
  surface: "#FFFFFF"
  success: "#15803D"
  warning: "#B45309"
  danger: "#B91C1C"
  text: "#0F172A"
  muted: "#64748B"
typography:
  heading:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 600
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
rounded:
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview

AITA is an academic platform for programming assignments,
automated grading, and AI-assisted code review.

The interface should prioritize clarity, trust, efficiency,
and information density appropriate for educational workflows.

## Colors

Use semantic colors consistently for success, warning, failure,
and neutral states. Avoid using color as the only status indicator.

## Typography

Use clear heading hierarchy and readable body text.
Keep code, test results, and grading feedback easy to scan.

## Layout

Use a consistent application shell, navigation, page spacing,
and responsive layouts across student and teacher dashboards.

## Components

Reuse existing buttons, form controls, tables, dialogs,
status badges, and feedback panels whenever possible.

## Do's and Don'ts

- Do keep student and teacher screens visually consistent.
- Do preserve accessible contrast and visible keyboard focus.
- Don't add decorative effects that distract from grading data.
- Don't change application behavior to achieve a visual effect.
