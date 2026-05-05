# Contributing to Reissulla

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop
- Git

### Getting Started

```bash
git clone https://github.com/Jhoneagle/Reissulla.git
cd Reissulla
pnpm install
docker compose up -d
pnpm dev
```

## Coding Standards

- **TypeScript** — strict mode, no `any` types
- **ESLint + Prettier** — run `pnpm lint` and `pnpm format:check` before committing
- **Accessibility** — all UI changes must pass `eslint-plugin-jsx-a11y` rules

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — maintenance (deps, CI, tooling)
- `docs:` — documentation changes
- `a11y:` — accessibility improvements
- `refactor:` — code restructuring without behaviour change
- `test:` — adding or updating tests

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure CI passes (`pnpm lint`, `pnpm type-check`, `pnpm test`)
4. Open a PR with a description of what and why
5. Address review feedback

## Reporting Issues

Use GitHub Issues with the provided templates for bug reports and feature requests.
