# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio and coaching website for Matt Feroz (matthewferoz.com). Static HTML/CSS/JavaScript site hosted on GitHub Pages with Jekyll.

## Development Commands

```bash
# Local development - serve static files
python -m http.server 8000
# or
npx http-server -p 8080

# Then access http://localhost:8000 or http://localhost:8080
```

No npm build process - all dependencies are CDN-based. Deployment is automatic via GitHub Pages on push to main.

## Architecture

### Technology Stack
- Vanilla HTML5/CSS3/JavaScript (ES6)
- Jekyll for static site generation
- GSAP 3.12.5 + ScrollTrigger for animations
- Typeform for embedded forms
- PostHog for analytics

### Key Files
- `main.js` - Global JavaScript: mobile nav, Typeform lazy loading, GSAP animations, video scroller, FAQ accordion
- `styles.css` - All styles (~1500 lines): design system uses orange (#f85f00), dark bg (#171719), Poppins font

### Page Structure
Each page (index.html, coaching/, contact/, guide/, resume/) follows a consistent template:
- Shared navbar with mobile menu toggle
- Hero section
- Content sections with scroll-triggered animations
- Footer with social links
- Typeform CTA integration

### Design Patterns
- Mobile animations disabled at ≤768px width
- Typeform iframes lazy-load via Intersection Observer
- Navbar uses glassmorphism blur effect
- Text swaps between full/short versions for responsive display (`*-full` and `*-short` classes)

### External Integrations
- Typeform Form ID: T2ZPmUED
- YouTube channel: @MattFeroz
- PostHog for analytics tracking
