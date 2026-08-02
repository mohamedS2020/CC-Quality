# CC‑Quality — System Guide (current state)

A practical guide to everything the system does **today**, who can do it, and the end‑to‑end
scenarios it supports — followed by the design notes a developer needs to keep in mind.

> Scope: this reflects the build through **task 7** plus the navigation shell and the read‑only
> config viewer. The Agent self‑service portal + notifications (task 8), dashboards/reports/exports
> (task 9), and migration/cutover (task 10) are **not built yet**.

---

## 1. What the system is

CC‑Quality is a **config‑driven call‑center quality scorecard**. Evaluators score calls against a
rubric; the system **derives every figure** (counts, accuracy, pass/fail, rank) from the errors that
were flagged — nothing numeric is ever typed in.

The defining principle (the "golden rule"): **the rubric, weights, benchmarks, levels, periods, and
thresholds are data, not code.** The scoring engine contains only mechanics; every domain value
(section codes like `CC`/`NC`, benchmarks like 95%, tenure thresholds) comes from a **configuration
version**.

---

## 2. Roles & access

There are three roles. Access is enforced **server‑side** on every page and action.

| Role | What it is | Access |
|---|---|---|
| **Admin** | Full control | Every permission, implicitly. |
| **Moderator** | Scorer/supervisor with **granular** rights | Exactly the permissions an Admin grants them. |
| **Agent** | The person being scored | Fixed self‑scope: can **view their own** evaluations and (later) their own reports. No access to the score sheet, config, imports, or any management screen. |

### Permission catalog

`evaluations.create`, `evaluations.edit`, `evaluations.view`, `imports.run`, `agents.manage`,
`users.manage`, `config.view`, `config.edit`, `dictionary.edit`, `periods.lock`, `reports.view`,
`reports.export`.

- **Admin** holds all of them.
- **Agent** holds exactly `evaluations.view` + `reports.view` (and only ever sees their own data).
- **Moderator** holds only what's toggled on for them; changes take effect on their **next request**.

The left‑hand navigation shows **only the sections a user can actually reach** — an Agent sees Home +
Evaluations; an Admin sees everything.

---

## 3. Signing in & sessions

- Go to `/login` and sign in with an email + password (accounts are created by an Admin — there is
  no self‑registration).
- Sessions are **DB‑backed** with a **sliding 30‑minute idle timeout** (`SESSION_IDLE_MINUTES`).
  Activity extends the session; inactivity expires it.
- **Sign out** is in the sidebar footer. An Admin password reset also invalidates the user's active
  sessions, forcing re‑login.

---

## 4. Navigation

A persistent left **sidebar** (collapses to a hamburger drawer on mobile) groups the app:

- **Home** — a role‑aware landing with quick‑action cards.
- **Scoring** — Evaluations · New score sheet · Import.
- **Administration** — Configuration · Periods · Agents · Users.

The active section is highlighted, and the footer shows your name, role, and Sign out. Items you
lack permission for are simply not shown.

---

## 5. Core concepts

- **Configuration version** — the whole rubric + policy as one immutable, versioned document. Editing
  publishes a **new version**; past scores stay pinned to the version they were scored under.
- **Rubric tree** — `Section → Category → Attribute → Error reason`. Evaluators flag error reasons;
  the engine maps each flag up to its section and scores it.
- **Sections** — e.g. `CC`, `EUC`, `BC`, `NC`. Each has a scoring mode (`section binary` or
  `graded attributes`), a `critical` flag, a rank weight, and a benchmark.
- **Lenses & benchmarks** — different ways to roll up accuracy (e.g. per‑error, per‑account); some
  are marked **provisional** until verified against real data.
- **Dictionary** — severities and training buckets, optionally attached to error reasons.
- **Policy** — version‑wide scalars: published decimal places, Pareto cutoff, and the **tenure/trial
  thresholds** (new‑agent days, trial window days).
- **Period** — the lockable month bucket a call belongs to; opens automatically, then moves through a
  lifecycle and can be locked to freeze its numbers.
- **Derive‑only** — the score sheet has no field for a count, accuracy, status, or rank. Those are
  computed on save from the flagged errors.

---

## 6. How to use it — service by service

### 6.1 Configuration (`/admin/config`)

- **Editors** (`config.edit`) get the full editor with tabs: **Sections**, **Rubric tree**,
  **Lenses & benchmarks**, **Dictionary**, and **Policy** (rounding, Pareto cutoff, tenure/trial
  days). A live validation panel lists anything blocking a save. **Save as new version** publishes an
  immutable version.
- **Viewers** (`config.view` only) get a **read‑only view** of the active version — policy, sections,
  the full rubric with dictionary tags, and lenses with provisional badges. No editing controls.

### 6.2 Score a call (`/evaluations/new`, `evaluations.create`)

1. Enter the **call details** (enter‑only): agent, QA owner, call date, optional start/end, duration,
   mobile, call ID, queue, transaction type (IB/OB), monitoring type, call type, coaching date.
2. **Flag every error** by ticking error reasons in the rubric tree. A live per‑section count shows
   how many you've flagged.
3. **Save.** The engine derives the sum of criticals, pass/fail, and status; stamps the config
   version; assigns the month period; masks the mobile. There is nowhere to type a score.

### 6.3 Import evaluations (`/evaluations/import`, `imports.run`)

1. Upload a **CSV or .xlsx** export (Quality Row Data / Error‑Type‑Per‑Agent shape).
2. **Validate** first — a dry run reports every row as **ready**, **duplicate** (already imported, by
   source id), or **error** (unknown error reason or an agent name that can't be resolved). Nothing is
   written.
3. **Import** to commit the ready rows. Agent names are normalized (including Arabic→English aliases)
   and every figure is derived through the same engine path as manual entry — imported rows are
   byte‑for‑byte equivalent to hand‑scored ones.

### 6.4 Browse & inspect evaluations (`/evaluations`, `evaluations.view`)

- The list shows the **current version** of each call (superseded versions are hidden): call date,
  agent, QA owner, **result** (Pass/Fail), and version (with a "corrected" marker).
- Open a call to see its details and its **full version history / audit trail** — for each version:
  who scored or corrected it, when, the correction reason, and the errors flagged.
- **Agents** see only their **own** calls here, and can't open anyone else's by URL.

### 6.5 Correct a scored call (`/evaluations/[id]/correct`, `evaluations.edit`)

- From a call's detail page, **Post a correction** opens a pre‑filled score sheet plus a **mandatory
  reason**.
- Saving **never mutates** the original: it stamps the old row superseded and writes a **new version**
  linked back to it, re‑derived under the **original's config version**, recording who/when/why.
- A correction is **blocked if the call's period is locked** — the period must be reopened first.

### 6.6 Periods (`/admin/periods`, `periods.lock`)

- A month **period opens automatically** the first time a call in that month is scored.
- Move it through **Open → Scoring → Review → Locked**, and **Reopen** a locked one.
- **Locked = immutable**: no new call can land in that month, and existing calls can't be corrected.
  Lock and reopen both record **who and when**.

### 6.7 Users (`/admin/users`, `users.manage`)

- List, create, and edit accounts (email, name, role, active). **Reset password** (logs the user
  out).
- For a **Moderator**, toggle their granular permissions from the catalog; they apply on the
  Moderator's next request.
- For an **Agent** account, you must **link it to an agent record** (one agent ↔ one user). Changing a
  user away from the Agent role clears the link.
- You **can't demote or deactivate your own account** (self‑lockout guard).

### 6.8 Agents (`/admin/agents`, `agents.manage`)

- List every agent with their **derived tenure status** (new/old), **trial** flag, and tenure in days
  — computed from `join_date` against the active config's thresholds.
- Create/edit an agent (`login_id`, `agent_name`, `tl_name`, `join_date`, active). Login IDs are
  unique. Agents are **deactivated, never deleted**.

### 6.9 The Agent experience (today)

An Agent signs in and sees **Home** + **Evaluations** (their own calls, read‑only, with history). The
richer self‑service portal and notifications are **task 8**.

---

## 7. End‑to‑end scenarios

**A. Standing up the scorecard.** An Admin opens Configuration, reviews/edits sections, rubric,
lenses, dictionary, and policy (tenure/trial = 90/90 by default), and Saves as a new version. That
version becomes the one all scoring uses.

**B. Onboarding people.** The Admin creates agent records (Agents), then user accounts (Users) —
granting a Moderator, say, `evaluations.create`, `evaluations.view`, and `imports.run`; and linking
each Agent user to its agent record.

**C. A month of scoring.** Moderators score calls (New score sheet) and/or bulk‑import them (Import →
Validate → Import). The July period opens automatically on the first July call. Everything is derived.

**D. A correction.** A reviewer finds a mis‑flagged critical on Hager's call, opens the call, posts a
correction with a reason. v1 is preserved as history; v2 becomes current with the corrected result.

**E. Closing the month.** Early August, the Admin moves July **→ Scoring → Review → Locked**. July's
numbers are now frozen: late calls and corrections are refused. If a genuine fix is needed, the Admin
**Reopens** July (audited), corrects, and **Locks** again.

**F. An agent checks in.** Hager signs in and sees only her own scored calls and their histories.

---

## 8. What isn't built yet

- **Agent self‑service portal & notifications** (task 8).
- **Dashboards, charts, reports, exports** (task 9) — the scoring engine (lenses, agent rank, Pareto,
  period trends) exists and is reconciled against the verified figures, but there's **no analytics UI
  yet**. `reports.view` / `reports.export` are dormant until then.
- **Migration / historical backfill / cutover** (task 10).
- Minor: a config **version‑history / rollback** UI and an **alias‑management** screen (aliases work in
  the importer, but aren't managed through a screen yet).

---

## 9. Developer design notes — keep these in mind

**The golden rule.** The engine (`src/lib/engine/**`) holds **no domain constants**. Section codes,
benchmarks, the NC denominator, tenure thresholds — all come from the loaded config. A static
hardcode‑guard test scans the engine and fails on a stray literal like `0.95`.

**Config is immutable + versioned.** Editing publishes a new `ScorecardConfig` (unique `version`,
exactly one `isActive`). Every evaluation is **stamped with its config version** (`configId`), so
historical figures stay reproducible even after the config changes. Saves retry on `P2002`/`P2034`
(version conflict / deadlock).

**Derive‑only (FR‑16).** `CreateEvaluationInput` has only enter‑only fields + flagged reason ids —
there is structurally no place to pass a figure. `buildEvaluationData` is the **single** place a row
is shaped; both first‑scoring and corrections go through it, so a correction is a re‑derivation, never
a hand‑edit.

**Corrections are versioned, never mutations (FR‑14/15).** A correction sets `supersededAt` on the old
row and writes a new row with `version + 1`, `correctionOfId` → the prior version, plus
`correctedById` / `correctionReason`. **Current version = `supersededAt IS NULL`.** Re‑scoring uses the
**original's** config version, so only the changed inputs move the numbers. History is walked via the
`correctionOfId` chain.

**Periods & lock immutability (FR‑44/45).** Month periods open on demand (`resolveMonthlyPeriod`).
`transitionPeriod` enforces the state machine and stamps lock/reopen audit. `createEvaluation` and
`correctEvaluation` both refuse to write into a `LOCKED` period.

**PII (FR‑19).** Mobile numbers are **masked on store** (the schema has no raw column), **masked on
display** (`displayMobile`), and **never placed in a URL** — enforced by the `pii-url-guard` test,
which scans source for the offending patterns (it automatically covers new files).

**Authorization is server‑side and authoritative.** `authorize(permission)` (throws 401/403) guards
every page/action **before** any protected data is read. The client `useCan` hook and the nav's
permission gating are **convenience only** — never a substitute. Keep nav gating and the page's own
guard **in agreement** (e.g. Configuration nav is gated on `config.view`, and the page serves a
read‑only viewer to view‑only holders and the editor to `config.edit` holders).

**Agent self‑scope (FR‑9).** `agentScopeFor(ctx)` yields `{kind:"all"}` for Admin/Moderator and
`{kind:"self", loginId}` for an Agent (failing **closed** to `-1` if somehow unlinked). Every
agent‑data query must derive its `where` from this (`evaluationScopeWhere`). The evaluations list and
detail already do.

**Tenure derivation (FR‑13).** `deriveAgentStanding(joinDate, config, asOf = now)` computes
`status` (old/new) and `inTrial` from the config thresholds. Rosters use `asOf = now`; **reporting
should pass a period start** to derive status "as of" a period (already supported + tested).

**Provisional lenses.** Program/Agent lenses are kept but flagged **provisional** until verified
against a critical‑error month (`VERIFIED_BASES = { PER_ERROR }`; `isLensProvisional`). Don't treat
their outputs as final.

**Config policy scalars.** `roundingDecimals`, `paretoCutoff`, `newAgentTenureDays`,
`trialWindowDays` live on the versioned config and round‑trip through `buildInputFromLoaded`; they're
edited in the **Policy** tab and shown in the read‑only viewer. Baseline defaults: 2 / 0.8 / 90 / 90.

**Key DB invariants.** `User.agentLoginId` is **unique** (one agent ↔ one user). `Period` is unique on
`(type, label)`. `EvaluationLine` is unique on `(evaluationId, errorReasonId)` — a reason is flagged
at most once per call. Config `version` is unique; exactly one `isActive`.

**Name normalization (FR‑12).** A shared normalizer + agent resolver (canonical names + Arabic→English
aliases, case‑insensitive) is used by **both** the form and the importer, so a name resolves the same
way everywhere.

**Testing conventions.**
- **Run DB suites serially:** `npm test -- --runInBand`. In parallel, multiple DB suites contend for
  memory/rows on this box and flake — serial is green every time. (CI should use `--runInBand` or a
  low `--maxWorkers`.)
- DB tests **create their own inactive config** and use **disjoint id ranges / email tags**, cleaning
  up by **exact id/version** (never range‑delete another suite's rows).
- `pii-url-guard` and the engine `hardcode-guard` are **source‑scanning** tests — they cover new files
  automatically.

**Environment gotchas.**
- The Next **dev server can OOM** (`Array buffer allocation failed`) under memory pressure while
  compiling a route — it's the environment, not the code. Restarting doesn't fix memory; free memory
  or rely on unit tests + typecheck.
- `prisma migrate dev` uses a shadow DB — watch disk space.
- Windows checkouts convert LF→CRLF on write (harmless warnings).

**Process notes.**
- **MVP scope freeze:** keep the PRD/tasks as‑is during the build; fold missing UI into its natural
  parent task; do the holistic review after the MVP runs.
- Verified numeric constants (baseline config values, reconciliation figures, tenure thresholds) are
  **cross‑checked with the product owner** before being locked in.
