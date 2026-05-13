# Changelog

All notable changes to DevPilot Rapid Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-13

### Changed

- Removed unreachable handler branches, achieving 100% line coverage across all modules (#25)

### Tests

- 214 passing tests across 12 test files
- GitLab client.js branch coverage improved from 93.5% to 100% (#23)
- Executor branch coverage improved from 91.7% to 100% (#23)
- Overall coverage: 99.73% statements (372/373), 98.4% branches (309/314), 98.55% functions (68/69), 100% lines (336/336)

## [0.2.0] - 2026-05-13

### Added

- All 6 Devpost submission fields in README (Built With, What It Does, How We Built It, Challenges, Accomplishments, What We Learned) (#14)
- Payload validation module with type checking, range constraints, and custom validators (#19)
- Payload validation handler wired into agent pipeline with comprehensive error reporting (#19)
- Vitest coverage configuration with per-file and global branch/line/function thresholds (#18)

### Changed

- Architecture diagram updated to reflect actual implementation structure (#16)
- Node.js minimum version fixed to 20+ across README and documentation (#16)
- CHANGELOG date corrected from 2025 to 2026 (#15)

### Tests

- 213 passing tests across 12 test files
- GitLab client.js branch coverage improved from 55% to 90%+ (#17)
- New `validate.test.js` with full coverage for payload validation module (#19)
- Planner.js branch coverage improved from 70.73% to 90.24% (#21)
- GitLab client.js function coverage improved to 100% with timeout/abort tests (#22)

## [0.1.0] - 2026-05-13

### Added

- Configuration utility module with validation and environment loading (#1)
- README with architecture diagram and demo walkthrough (#2)
- Middleware pipeline with `Agent` and `Pipeline` classes (#4)
- Built-in handlers: echo, transform, cloud-status, batch
- GitLab MR review agent with planner/executor pattern (#6)
- GitLab client for MR diff fetching and comment posting
- GitLab MCP handler for issue triage with classification and priority detection (#8)
- Issue triage: `fetchIssues`, `classifyIssue`, `triageIssues` in `src/utils/gitlab.js` (#8)
- GitLab API fetch timeout (10s AbortController) and URL validation (#8)
- Vertex AI integration for AI-powered code review
- Heuristic fallback review (no API key required)
- Cloud Run deployment configuration (Dockerfile, cloudbuild.yaml) (#9)
- GitHub Actions CI pipeline (Node 20/22 matrix, vitest) (#9)
- Gemini/Vertex AI client with generate, review, and chat support (#10)
- Gemini handler wired into agent pipeline (generate/review/chat actions)
- `.env.example` with documented configuration variables (#7)
- `.gitignore` for standard Node.js exclusions (#5)
- Devpost submission writeup with all 6 required fields
- Demo walkthrough in `docs/demo.md` (7-step GitLab workflow demo)

### Changed

- Switched test runner from vitest to node:test, then back to vitest (#3)
- Bumped Node.js minimum to >=20.12.0 for vitest 4.x compatibility
- Bumped cloudbuild.yaml from node:18 to node:20
- Gemini `generate()` now passes `systemInstruction` in request body (was silently dropped)
- API key moved from URL query param to `x-goog-api-key` header to prevent credential leakage

### Tests

- 134 passing tests across 11 test files
- Full coverage for config, handlers, pipeline, planner, executor, GitLab client, GitLab MCP handler, Vertex AI, Gemini client, and integration
