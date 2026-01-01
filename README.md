# 🌟 MoLOS: Modular Life Organization System

[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue.svg)](https://github.com/MoLOS-App/MoLOS/pkgs/container/molos)

### Your life isn't one-size-fits-all. Your organizer shouldn't be either.

MoLOS is a fast, privacy-focused, and deeply modular productivity suite designed to help you reclaim your focus. Built with a "local-first" philosophy and a modern tech stack, it bridges the gap between simple to-do lists and complex second-brain systems.

---

## ✨ Why MoLOS?

Most productivity apps are either too simple to be useful or too complex to maintain. MoLOS was born from a desire for something different:

- **🚀 Blazing Fast:** Built with SvelteKit for near-instant interactions.
- **🧩 Truly Modular:** Only use what you need. Tasks, Notes, and Routines are integrated but independent.
- **🔒 Privacy First:** You own your data. Self-host it on your own hardware and never worry about cloud lock-in.
- **📱 Cross-Platform:** A consistent experience across desktop and mobile.

---

## 🎯 Core Modules

### 📋 Tasks: Master Your Day

Stop wading through the noise. MoLOS uses a lightweight **Eisenhower Matrix** (Urgent/Important) to help you instantly spot the tasks that actually move the needle.

- **Smart Focus:** Priority levels and tags that make sense.
- **Recurring Logic:** Set it and forget it—daily, weekly, or custom routines.
- **Context Linking:** Connect tasks directly to notes or habits.

### 🧠 Knowledge: Your Digital Brain

A structured home for your thoughts, organized and instantly searchable.

- **Markdown Power:** Write sharp, structured content with a robust editor.
- **Hierarchical Folders:** Organize like a pro with nested structures and tags.
- **Lightning Search:** Find that one note from three months ago in milliseconds.

### 🏃 Routines: Build Momentum

Habits are the compound interest of self-improvement. Track them without the friction.

- **Flexible Tracking:** Simple yes/no habits or measurable inputs (water, pages, minutes).
- **Streak Protection:** Server-side calculations ensure your progress is always accurate.
- **Visual Progress:** Beautiful calendars and progress bars to keep you motivated.

---

## 🚀 Quick Start (Self-Hosting)

The fastest way to get MoLOS running is via Docker. We provide a pre-built image ready for deployment.

### 1. Pull the Image

```bash
docker pull ghcr.io/eduardez/molos:latest
```

### 2. Run with Docker Compose

Create a `docker-compose.yml` file:

```yaml
services:
  molos:
    image: ghcr.io/eduardez/molos:latest
    ports:
      - '4173:4173'
    volumes:
      - ./molos_data:/data
      - ./molos_data/external_modules:/app/external_modules
    environment:
      - DATABASE_URL=file:/data/molos.db
      - BETTER_AUTH_SECRET=<Just run "openssl rand -base64 32" to generate one>
      # Add other env vars as needed
```

Then run:

```bash
docker compose up -d
```

---

## 🏗️ For Developers

MoLOS is built for extensibility. If you're a developer, you'll love the clean architecture.

### The Tech Stack

| Component        | Technology                               | Role                                                 |
| :--------------- | :--------------------------------------- | :--------------------------------------------------- |
| **Frontend/API** | [SvelteKit](https://kit.svelte.dev/)     | Full-stack framework for UI and REST/tRPC endpoints. |
| **Database**     | [SQLite](https://www.sqlite.org/)        | Lightweight, reliable, and easy to back up.          |
| **ORM**          | [Drizzle](https://orm.drizzle.team/)     | Type-safe database operations.                       |
| **Styling**      | [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling for a clean, modern UI.        |

### Local Development

1.  **Clone:** `git clone https://github.com/MoLOS-App/MoLOS.git`
2.  **Install:** `npm install`
3.  **Dev:** `npm run dev`

---

## 🤝 Contributing

We love contributors! Whether you're fixing a bug, adding a module, or improving documentation, your help is welcome. Check out our [Development Guide](docs/guides/developing-new-modules/INDEX.md) to see how we build things.

---

_MoLOS is a passion project built to make life organization painless. If you find it useful, consider giving us a ⭐ on GitHub!_
