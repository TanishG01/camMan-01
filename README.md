# FestOps — Media Team Management

A full-stack MERN application purpose-built for college media house operations during cultural and technical festivals (photography, videography, SD card tracking, equipment custody, and junior-senior mentorship).

## Core Philosophy
> **"Record both what was planned and what actually happened."**

Pre-fest planning frequently diverges from fest execution. Schedules slip, events run late, equipment gets handed off in corridors, and SD cards linger in pockets. FestOps captures the ground reality without erasing original plans.

---

## Tech Stack

- **Monorepo**: Plain npm workspaces (`server/` and `client/`)
- **Backend**: Node.js (LTS v20+) + Express.js + Mongoose v8
- **Database**: MongoDB (Local connection: `mongodb://127.0.0.1:27017/festops`)
- **Authentication**: Firebase Authentication (Google OAuth) + Server-issued signed JWT stored in HTTP-only cookie
- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide React + TanStack Query v5 + Axios
- **File Parsing**: `xlsx` for Excel schedule spreadsheet imports
- **Background Jobs**: `node-cron` in-process scheduler for automated event reminders and overdue gear checks
- **Testing**: Jest + Supertest + `mongodb-memory-server`

---

## User Roles & Hierarchy

1. **Admin / Coordinator** (4th Year): Full administrative control over festivals, venues, events, schedule imports, inventory registration, assignment approvals, and immutable audit logs.
2. **Senior / Team Lead** (2nd & 3rd Year): Manages coverage on the ground, mentors 1st-year juniors, coordinates replacements during delays, confirms equipment checkouts/returns, and validates footage handovers.
3. **Junior / Member** (1st Year): Assigned to events with a senior mentor, views daily agenda and held equipment, submits coverage notes and unplanned event reports.

---

## Getting Started

### 1. Prerequisites
- Node.js (v20+ recommended)
- Local MongoDB running on `127.0.0.1:27017`

### 2. Installation
From the root directory:
```bash
npm install
```

### 3. Seed Demo Data (Optional)
Prime your local database with sample users, venues, equipment, events, and mentorship assignments:
```bash
npm run seed
```

### 4. Start Development Servers
Start both the Express backend (port 5001) and Vite React frontend (port 5173) simultaneously:
```bash
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5001/api/v1](http://localhost:5001/api/v1)

---

## Running the Automated Test Suite

Run all 34 automated unit and integration tests across all 8 test suites:
```bash
npm test
```

### Test Suite Breakdown:
1. `tests/integration/auth.test.js` — Google login, cookie sessions, user auto-creation, RBAC enforcement.
2. `tests/integration/events.test.js` — Event creation, `.xlsx` schedule import preview & commit, Case 1 delay handling, Case 4 cancellation handling.
3. `tests/unit/assignmentEngine.test.js` — Multi-factor scoring logic, availability constraints, travel buffers, workload balancing.
4. `tests/integration/assignments.test.js` — Automated assignment suggestions, Case 2 junior-senior mentorship enforcement, reassignment history preservation.
5. `tests/unit/equipmentFSM.test.js` — State machine transitions, checklist verification, damaged asset maintenance routing.
6. `tests/integration/equipment.test.js` — Case 8 atomic concurrency allocation (zero double-bookings), Case 5 independent camera & SD card returns.
7. `tests/integration/coverage.test.js` — Case 7 unplanned event multi-contributor attribution, Case 6 SD card corruption locking verification.
8. `tests/integration/audit.test.js` — Immutable audit log recording, non-deletable routes, RFC-4180 CSV streaming export.

---

## 8 Operational Edge Cases Handled

| Case | Scenario | System Behavior & Guarantee |
|---|---|---|
| **Case 1** | Delayed event conflicts with member's next assignment | Member prioritizes next scheduled event. System flags delayed event as needing revised coverage, detects conflicts with subsequent assignments, notifies leads, and preserves original assignment history. |
| **Case 2** | First-year member has no senior mentor | Every 1st-year member must have an assigned 2nd/3rd year senior mentor. If unpaired, system marks assignment as `isMentorNeeded: true`, surfaces an alert banner, and blocks unmentored finalization. |
| **Case 3** | Same camera needed at two simultaneous events | Server rejects overlapping physical allocations. Sequential camera feasibility engine checks travel and setup buffers between venues. |
| **Case 4** | Event cancelled after equipment checkout | Cancelling an event updates the schedule but does **not** return equipment. Physical equipment checkouts remain open until explicitly returned and inspected. |
| **Case 5** | Camera returned but SD card still with photographer | Cameras and SD cards are tracked as independent physical assets. Returning a camera marks only the camera available; the SD card remains checked out to the photographer until physically received. |
| **Case 6** | SD card corruption or backup failure | Pre-use checklist provided at checkout. If an SD card is flagged with corruption or missing footage, verification is locked (`issue_recheck_required`) and cannot be marked verified until resolved. |
| **Case 7** | Member covers extra or unplanned event | Quick unplanned event reporting form captures multi-member contributor attribution. The reporter is not auto-credited solely; all actual contributors receive verified work credit upon lead approval. |
| **Case 8** | Two coordinators request same camera simultaneously | Atomic conditional update (`findOneAndUpdate({ _id, status: 'available' })`) guarantees exactly one allocation succeeds with 200 OK while conflicting requests fail fast with 409 Conflict. Zero double-allocations. |

---

## License
MIT • Built for university media houses & fest organizing committees.
