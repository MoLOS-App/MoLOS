<img width="96" height="96" alt="MoLOS icon" src="static/favicon.svg" align="right">

# MoLOS

MoLOS is a modular, local-first workspace you can shape into whatever you need.
It is for people who want a fast, private home base they can control.

## Why MoLOS exists

Most productivity tools start simple and end up noisy. They add features you do not use,
move your data into someone else's cloud, and slow down over time. MoLOS is the opposite.
It stays lean, runs on your hardware, and grows only when you want.

If you want a calm, private place to build your own system, try it. If you don't like it you just need to remove it. Just one command.

## What you get

- Local-first by default and easy to self-host
- Speed. Even on older machines that at least can run Doom
- Modularity and control
- Full ownership of your data and workflow
- Built for long-term use


## What people build with it

MoLOS is a base, not a box. A few real examples:

- [MoLOS-Tasks](https://github.com): Simple tasks and project management. The first module created
- [MoLOS-CRM](https://github.com): Mini CRM for clients and follow-ups 
- [MoLOS-AI Hub](https://github.com): Centralized AI prompt store
- [MoLOS-Docustore](https://github.com): Personal knowledge docs hub
- [MoLOS-Homeboard](https://github.com): Self-hosted dashboard for home or work
- [MoLOS-3DP](https://github.com): 3D printer control center

Start with one use case. Add more when it makes sense.

You can also keep it small, I won't judge.

## Who it is for

- Developers who want a clean, fast workspace
- Power users who like to tune their own systems
- People who care about privacy and local storage
- Anyone tired configuring Notion and after all the work end up not using it

## Quick start (Podman)

First make the persistence folders:

```bash
mkdir -p ./molos_data/db
mkdir -p ./molos_data/external_modules
```

Then start MoLOS:


```bash
podman run -d \
  -p 4173:4173 \
  -v ./molos_data/db:/data \
  -v ./molos_data/external_modules:/app/external_modules \
  -e DATABASE_URL=file:/data/molos.db \
  -e PORT=4173 \
  -e MOLOS_AUTOLOAD_MODULES=true \
  -e FORCE_REBUILD=true \
  ghcr.io/molos-app/molos:latest
```

Open `http://localhost:4173`. Your data stays in `./molos_data`.

That is the whole setup. You can stop here and explore.

## Screenshots

<!-- Screenshot: Dashboard overview -->
<!-- Screenshot: Module picker -->
<!-- Screenshot: Example workspace -->

## Modular system, plain English

MoLOS is built from small modules. Add or remove them without breaking the core app.
Keep it minimal, or assemble a full workspace over time.

If you are working from source, drop modules into `external_modules/` and run
`npm run module:sync`.

Modules can be shared, versioned, and replaced. Your data stays in one place.

## Privacy and control

MoLOS is local-first. It runs on your machine and stores data locally by default.
You decide if and how it is exposed to the network.

Backups are simple. Move `./molos_data` to a new machine and you are done.

## For developers

[Docs](https://molos-docs.eduard3v.com)

The codebase is small on purpose. It is easy to read, easy to extend, and easy to own.

If you want to build a module or know why I made some architectural decisions, start there.

## Contributing

Issues and PRs are welcome. If you build something useful, share it.
If MoLOS helps you, star it and tell a friend!.
