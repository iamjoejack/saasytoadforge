---
name: steampunk-design-system
description: >-
  Guides styling, layout, typography, and theme decisions matching the SaaSyToad Steampunk Brand.
  Covers curated color pallets (Brass, Copper, dark charcoal), typography (Cinzel, Inter), panel borders (riveted, blueprints),
  and glassmorphic hover animations. Use when designing user dashboards, adjusting component layouts, or adding styles.
---

# Steampunk Design System & Brand Guidelines

This guide defines styling standards for SaaSyToad Forge layouts.

## 1. Typography & Grid Architecture
- **Headers**: Accent headers must use the `Cinzel` font (a serif typography reminiscent of old clocks and dials). Use tracking-wide or tracking-wider text.
- **Body & Code**: Normal body text uses clean sans-serif like `Inter` or `Outfit` for maximum legibility. System shell outputs use monospaced fonts (e.g. `JetBrains Mono`).
- **Circuit Grid**: Dashboards must feature a blueprint style background grid (subtle 5% opacity overlapping gridlines).

## 2. Color Palette
- **Primary Brass**: Accent buttons and active borders use a rich brass/gold tint (`#b5a642` or `hsl(51, 45%, 48%)`).
- **Subtle Copper**: Secondary text and warning cards can use bronze/copper gradients.
- **Charcoal Dark Mode**: The UI is predominantly dark, starting at `#0c0c0e` with cards styled as semi-transparent glass panes (`bg-white/[0.02]`) with thin, dark borders.

## 3. Industrial Accents (Rivets & Gears)
- **Rivet Boarders**: Important panels should have a "riveted panel" border style. This features rounded corners with small metallic dots (mock rivets) in the corners.
- **Gears & Micro-animations**:
  - Interactive status badges (like waiting or loading) should spin a subtle gear icon or display glowing brass pulses.
  - Hover effects on cards should scale them up slightly and shift their border colors from dark zinc to brass/gold.
