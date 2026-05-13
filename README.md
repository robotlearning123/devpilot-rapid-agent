# DevPilot — AI DevOps Agent

> A Gemini-powered agent that automates development workflow tasks using GitLab MCP and Google Cloud Agent Builder.

DevPilot monitors your GitLab projects, triages issues, reviews merge requests, triggers pipelines, and generates release notes — all through natural language commands. It moves beyond chatbot Q&A into **real task execution**: the agent plans multi-step workflows, calls GitLab tools via MCP, and keeps you in control at every stage.

Built for the [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/).

## Architecture

```
[ARCHITECTURE DIAGRAM PLACEHOLDER]

┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│              (CLI / Google Cloud Console)                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Google Cloud Agent Builder                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Gemini 3   │  │  Reasoning   │  │   Planner     │  │
│  │  (LLM core)  │  │   Engine     │  │  (multi-step) │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         └─────────────────┼──────────────────┘          │
│                           │                              │
│  ┌────────────────────────▼─────────────────────────┐   │
│  │              Tool Orchestrator                     │   │
│  │  (routes tasks to MCP tools, manages state)       │   │
│  └────────────┬──────────────────────┬───────────────┘   │
└───────────────┼──────────────────────┼───────────────────┘
                │                      │
┌───────────────▼──────────┐  ┌────────▼──────────────────┐
│    GitLab MCP Server      │  │   Google Cloud Services   │
│  ┌─────────────────────┐  │  │  ┌────────────────────┐  │
│  │ Issues / MR / CI     │  │  │  │ Cloud Run (deploy) │  │
│  │ Pipelines / Boards   │  │  │  │ Cloud Storage      │  │
│  │ Labels / Comments    │  │  │  │ Secret Manager     │  │
│  └─────────────────────┘  │  │  └────────────────────┘  │
└───────────────────────────┘  └──────────────────────────┘
```

### Components

| Component | Role |
|-----------|------|
| **Gemini 3** | LLM core — natural language understanding, reasoning, code review |
| **Agent Builder** | Google Cloud orchestration — agent lifecycle, tool routing, state |
| **Planner** | Decomposes complex goals into ordered tool-call sequences |
| **Tool Orchestrator** | Invokes MCP tools, handles retries, enforces guardrails |
| **GitLab MCP Server** | Partner integration — issues, MRs, pipelines, boards |
| **Cloud Run** | Hosts the agent as a stateless service |
| **Secret Manager** | Stores GitLab tokens and API keys |

## Setup

### Prerequisites

- Node.js 18+
- Google Cloud account with Agent Builder API enabled
- GitLab account with personal access token (scopes: `api`, `read_repository`)
- Google Cloud CLI (`gcloud`) installed and authenticated

### Install

```bash
git clone <repo-url>
cd wanman-h-29711
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Description |
|----------|-------------|
| `GITLAB_TOKEN` | GitLab personal access token |
| `GITLAB_PROJECT_ID` | Default GitLab project ID |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | GCP region (e.g., `us-central1`) |

### Run Locally

```bash
npm start
```

### Deploy to Google Cloud

```bash
gcloud run deploy devpilot \
  --source . \
  --region us-central1 \
  --set-env-vars "$(cat .env | xargs)"
```

## Usage

DevPilot accepts natural language instructions. Example commands:

```
> Triage all open issues in project X and label them by category
> Review MR !42 and post inline comments for code quality issues
> Run the staging pipeline and notify me if it fails
> Generate release notes for milestone v2.1
> Create a board view of issues assigned to @alice, grouped by priority
```

The agent plans the required steps, shows you the plan, and executes each step using GitLab MCP tools.

## Google Cloud Services Used

| Service | Purpose |
|---------|---------|
| **Agent Builder** | Agent creation, orchestration, tool integration |
| **Vertex AI / Gemini** | LLM inference for reasoning and code review |
| **Cloud Run** | Serverless hosting for the agent service |
| **Secret Manager** | Secure storage of API tokens |
| **Cloud Logging** | Agent execution logs and audit trail |

## Partner Integration

**GitLab** via MCP server provides:
- Issue management (create, list, label, assign, close)
- Merge request operations (review, comment, approve, merge)
- Pipeline control (trigger, monitor, retry)
- Board management (create, update, move cards)

## Testing

```bash
npm test
```

## License

Apache-2.0
