# Changelog

All notable changes to DevPilot Rapid Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-05-13

### Added

- Configuration utility module with validation and environment loading (#1)
- README with architecture diagram and demo walkthrough (#2)
- Middleware pipeline with `Agent` and `Pipeline` classes (#4)
- Built-in handlers: echo, transform, cloud-status, batch
- GitLab MR review agent with planner/executor pattern (#6)
- GitLab client for MR diff fetching and comment posting
- Vertex AI integration for AI-powered code review
- Heuristic fallback review (no API key required)
- Cloud Run deployment configuration (Dockerfile, cloudbuild.yaml) (#9)
- GitHub Actions CI pipeline (Node 20/22 matrix, vitest) (#9)
- Gemini/Vertex AI client with generate, review, and chat support (#10)
- Gemini handler wired into agent pipeline (generate/review/chat actions)
- `.env.example` with documented configuration variables (#7)
- `.gitignore` for standard Node.js exclusions (#5)

### Changed

- Switched test runner from vitest to node:test, then back to vitest (#3)
- Bumped Node.js minimum to >=20.12.0 for vitest 4.x compatibility
- Bumped cloudbuild.yaml from node:18 to node:20

### Tests

- 100 passing tests across 10 test files
- Full coverage for config, handlers, pipeline, planner, executor, GitLab client, Vertex AI, and Gemini client
