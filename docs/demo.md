# DevPilot Demo Script

A step-by-step walkthrough demonstrating DevPilot — an AI DevOps agent powered by Gemini and Google Cloud Agent Builder with GitLab MCP integration.

## Prerequisites

- DevPilot running locally (`npm start`) or deployed to Cloud Run
- GitLab project with at least 5 open issues and 1 merge request
- GitLab personal access token configured in `.env`

## Demo Flow

### Step 1: Start the Agent

```bash
npm start
```

Expected output:

```
DevPilot v0.1.0 — AI DevOps Agent
Connected to Google Cloud Agent Builder (us-central1)
GitLab MCP server: connected (project: acme/app)
Ready. Type a command or 'help' for options.
```

### Step 2: List Open Issues

```
> Show me all open issues in the current project
```

Expected output:

```
Planning: fetch open issues from GitLab...

Found 8 open issues:

  #142  [bug]     Login page crashes on mobile Safari         High
  #143  [feature] Add dark mode toggle to dashboard            Medium
  #144  [bug]     CSV export drops rows > 1000                 High
  #145  [feature] Webhook notifications for pipeline failures  Medium
  #146  [docs]    Update API reference for v2 endpoints        Low
  #147  [feature] Rate limiting on public API endpoints        Medium
  #148  [bug]     Search returns stale results after merge     Medium
  #149  [chore]   Upgrade Node.js runtime to v22               Low

8 issues shown. Say 'triage' to auto-label and prioritize, or pick one to act on.
```

### Step 3: Auto-Triage Issues

```
> Triage all open issues — label by category and set priority based on description
```

Expected output:

```
Planning: analyze each issue, determine labels and priority...

Step 1/3: Reading issue descriptions via GitLab MCP...
Step 2/3: Gemini classifying categories and urgency...
Step 3/3: Applying labels to 8 issues...

Results:
  #142 → label:bug, priority:critical, component:auth
  #143 → label:feature, priority:medium, component:ui
  #144 → label:bug, priority:high, component:export
  #145 → label:feature, priority:medium, component:ci
  #146 → label:docs, priority:low, component:api
  #147 → label:feature, priority:high, component:api, security
  #148 → label:bug, priority:medium, component:search
  #149 → label:chore, priority:low, component:infra

Labels applied to 8 issues. Recommend addressing #142 and #144 first.
```

### Step 4: Review a Merge Request

```
> Review MR !15 and post comments on any code quality issues
```

Expected output:

```
Planning: fetch MR diff, analyze code, post review comments...

Step 1/4: Fetching MR !15 diff via GitLab MCP...
Step 2/4: Gemini reviewing code for quality, security, and style...
Step 3/4: Generating inline comments...
Step 4/4: Posting review to GitLab...

Review posted on MR !15 — 3 comments:

  src/auth/login.js:42
    ⚠ Hard-coded redirect URL — move to config

  src/api/export.js:118
    ⚠ No stream cleanup on error — potential memory leak

  src/api/export.js:125
    💡 Consider using batched writes for rows > 1000

MR review complete. Summary: 2 warnings, 1 suggestion. No blockers.
```

### Step 5: Trigger a Pipeline

```
> Run the staging pipeline and alert me if it fails
```

Expected output:

```
Planning: trigger pipeline, monitor status...

Step 1/2: Triggering pipeline on branch 'staging' via GitLab MCP...
  Pipeline #487 created

Step 2/2: Monitoring pipeline status...
  [build]     ✓ passed (42s)
  [test]      ✓ passed (1m 18s)
  [lint]      ✓ passed (12s)
  [deploy]    ✓ passed (35s)

Pipeline #487: all stages passed. Staging environment updated.
No alert needed — everything green.
```

### Step 6: Generate Release Notes

```
> Generate release notes for everything merged since v2.0
```

Expected output:

```
Planning: fetch merged MRs since v2.0, summarize changes...

Step 1/2: Querying merged MRs via GitLab MCP (since tag v2.0)...
Step 2/2: Gemini summarizing changes...

## Release Notes — v2.1

### Features
- Dark mode toggle on dashboard (!13)
- Webhook notifications for pipeline failures (!14)
- Rate limiting on public API endpoints (!17)

### Bug Fixes
- Mobile Safari login crash (!11)
- CSV export row limit fix (!12)
- Stale search results after merge (!16)

### Infrastructure
- Node.js runtime upgraded to v22 (!18)

7 merge requests included. Release notes ready to post.
Post these notes to GitLab releases? (y/n)
```

### Step 7: Cloud Verification

Verify the agent is running on Google Cloud:

```bash
# Check Cloud Run service
gcloud run services describe devpilot --region us-central1

# Check Agent Builder agent
gcloud ai agent-builder agents list --location us-central1

# View agent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=devpilot" \
  --limit 20 --format json
```

Expected: service is active, agent responds to requests, logs show tool invocations.

## What This Demonstrates

| Hackathon Criteria | Demo Coverage |
|---|---|
| **Move Beyond Chat** | Agent executes real GitLab actions (label, comment, trigger pipelines) |
| **Multi-Step Mission** | Triage analyzes 8 issues in sequence; review reads diff then posts comments |
| **Partner Power** | GitLab MCP server provides all tool capabilities |
| **Gemini Reasoning** | Code review, issue classification, release note summarization |
| **Google Cloud** | Agent Builder orchestration, Cloud Run hosting, Cloud Logging |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "GitLab MCP connection failed" | Check `GITLAB_TOKEN` in `.env` and token scopes |
| "Gemini quota exceeded" | Verify Vertex AI API is enabled and billing is active |
| "Pipeline not found" | Ensure the branch has a `.gitlab-ci.yml` |
| "No issues found" | Check `GITLAB_PROJECT_ID` matches your test project |
