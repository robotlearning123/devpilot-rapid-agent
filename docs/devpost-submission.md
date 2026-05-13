# Devpost Submission — DevPilot: AI DevOps Agent

> Copy each section into the corresponding Devpost form field.

---

## Field 1: Project Name

```
DevPilot — AI DevOps Agent
```

---

## Field 2: Short Description (Tagline)

```
A Gemini-powered agent that automates GitLab merge request code review—fetching diffs, running multi-category AI analysis (security, correctness, performance, style), and posting actionable findings back as MR comments. Built with Google Cloud Vertex AI and GitLab MCP.
```

---

## Field 3: Description

### What It Does

DevPilot is an AI-powered DevOps agent that automates the most tedious part of code review: reading diffs, reasoning about code quality across multiple dimensions, and posting structured feedback directly on GitLab merge requests.

Here's the workflow:

1. **Fetch** — DevPilot connects to your GitLab project via REST API v4 and pulls the diff for any open merge request.
2. **Plan** — The Planner module analyzes the diff and generates a prioritized, multi-category review plan. Security-sensitive files (`.env`, `.sql`, `.yaml`) get flagged first. Large files (>50 lines changed) receive dedicated performance reviews.
3. **Execute** — The Executor runs each plan step against Vertex AI Gemini 1.5 Flash, with exponential-backoff retry logic (3 attempts, increasing delays).
4. **Post** — Review findings are formatted as a markdown report and posted directly as an MR comment on GitLab.

The agent also exposes a general-purpose middleware pipeline for extensible task handling — built-in handlers include echo, text transform, cloud status checks, and batch processing.

### How We Built It

**Architecture** — DevPilot is built around two parallel paths:

- **Path 1: General Task Pipeline** — An `Agent` class orchestrates a `Pipeline` of middleware handlers. Each handler inspects the task; the first handler to return a non-null result wins. This gives us extensible, composable task processing.
- **Path 2: MR Review Loop** — A dedicated review orchestrator (`review.js`) ties together config loading, GitLab client, AI planner, and executor into a single `runAgent()` call.

**Key design decisions:**

- **Dependency injection everywhere** — Every module accepts injectable dependencies (`fetch`, `deps`). This makes the entire codebase testable without real API credentials.
- **Graceful degradation** — When Vertex AI is unavailable (no credentials, quota exceeded, network error), DevPilot falls back to a heuristic regex-based reviewer that detects hardcoded credentials, `eval()` usage, TODO/FIXME markers, `console.log` in production, and empty catch blocks.
- **Priority-based planning** — Review steps are sorted by severity: security > correctness > performance > style > maintainability. Security-critical files always get reviewed first.

**Google Cloud services:**
- **Vertex AI / Gemini 1.5 Flash** — LLM inference for code reasoning and review
- **Cloud Run** — Serverless deployment target (Dockerfile + cloudbuild.yaml included)
- **Secret Manager** — Secure credential storage for GitLab tokens

**Partner integration:**
- **GitLab REST API v4** — Merge request listing, diff retrieval, and review comment posting

**Testing** — 32+ tests across 8 test files with full coverage of all modules, including error paths and retry logic. Every handler, the pipeline, config, planner, executor, GitLab client, and Vertex AI reviewer have dedicated test suites.

### Challenges We Ran Into

1. **API resilience** — Vertex AI endpoints can be flaky under load. We solved this with configurable retry logic (exponential backoff, 3 attempts) and a complete heuristic fallback path that works with zero cloud credentials.

2. **Diff parsing complexity** — GitLab's diff format varies across file types and edge cases (binary files, renamed files, zero-line changes). We built a robust hunk parser using regex-based extraction of `@@ -a,b +c,d @@` headers with sensible defaults.

3. **Testing without credentials** — Every external dependency (GitLab API, Vertex AI, even `fetch`) needed injection points so tests could run with mocked responses. This required careful interface design across all modules.

4. **Plan prioritization** — Naive round-robin review missed security-critical files buried in large MRs. We implemented priority-based sorting that always surfaces security reviews first, regardless of file position in the diff.

### Accomplishments That We're Proud Of

- **Zero-credential fallback** — DevPilot works out of the box with heuristic review, no API keys required. Teams can start immediately and upgrade to AI-powered review when ready.
- **Clean architecture** — The dual-path design (pipeline + review loop) keeps the general-purpose agent framework cleanly separated from the specialized MR review workflow.
- **32+ passing tests** — Every module has comprehensive test coverage including error paths, edge cases, and mocked API responses.
- **Real GitLab integration** — Not a mock — DevPilot reads actual merge request diffs and posts real review comments via GitLab's API.

### What We Learned

- **Graceful degradation is a feature, not a hack** — Building the heuristic fallback first, then wrapping it with the AI layer, produced a more robust system than starting with the cloud API.
- **Dependency injection pays off immediately** — Making `fetch` injectable from day one meant we never needed to set up complex mocking frameworks. Simple function parameters replaced entire test libraries.
- **Priority-based planning > batch processing** — Sorting review steps by severity before execution means the most important findings surface first, even if the review is interrupted or rate-limited.

### What's Next for DevPilot

- **GitLab MCP server integration** — Upgrade from REST API to Model Context Protocol for richer tool use and real-time project context.
- **Inline review comments** — Post findings on specific diff lines instead of a single summary comment.
- **Review learning** — Track which findings developers resolve vs. dismiss, and adjust review sensitivity over time.
- **Multi-repo dashboards** — Aggregate review metrics across projects to surface systemic code quality trends.
- **GitHub support** — Extend the same review pipeline to GitHub pull requests via GitHub API.

---

## Field 4: Video Demo (~3 minutes)

```
[Insert YouTube or Vimeo URL here after recording]

Suggested video outline:
  0:00 - Intro: "DevPilot automates MR code review using Gemini"
  0:15 - Show the agent starting and connecting to GitLab
  0:30 - Demo: List open merge requests
  0:50 - Demo: Run AI review on an MR with security issues
  1:30 - Show review findings posted as GitLab comments
  1:50 - Demo: Heuristic fallback when cloud is unavailable
  2:15 - Architecture walkthrough (dual-path design)
  2:45 - Testing: run the full test suite
  3:00 - Closing + GitHub link
```

---

## Field 5: Try It Out

### Hosted Project URL

```
[Insert Cloud Run URL after deployment]
Example: https://devpilot-XXXXX-uc.a.run.app
```

### Source Code Repository

```
https://github.com/<org>/devpilot-rapid-agent
```

> Repository is public with Apache-2.0 license visible in the About section.

---

## Field 6: Built With

```
gemini, vertex-ai, google-cloud-run, google-secret-manager, gitlab-api, node.js, javascript, vitest
```

---

## Judging Criteria Alignment

| Criterion | How DevPilot Addresses It |
|-----------|---------------------------|
| **Technological Implementation** | Vertex AI Gemini for review reasoning, Cloud Run deployment, GitLab REST API v4 integration, retry logic, dependency injection, heuristic fallback |
| **Design** | Dual-path architecture (pipeline + review loop), priority-based planning, graceful degradation, middleware pattern |
| **Potential Impact** | Every developer who uses GitLab benefits from automated code review — catches security issues, performance concerns, and style violations before merge |
| **Quality of the Idea** | Moves beyond chat — the agent takes real actions (fetch diffs, analyze code, post comments) through a multi-step planning and execution pipeline |
