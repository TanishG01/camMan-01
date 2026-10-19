# FestOps — Final Product Requirements and Implementation Plan

## 1. Project Overview

I want to build **FestOps — Media Team Management**, a web application for managing college fest photography and videography operations.

I am a coordinator in my college Media House. We have first-year, second-year, and third-year members. Before a fest, we receive event schedules in Excel sheets or PDFs and manually prepare assignments, coordinate equipment, and track event coverage. During the fest, event timings change, equipment gets reassigned, members cover additional events, and footage must be handed over and backed up.

FestOps should centralize this entire workflow in one application. It should help coordinators plan work before the fest, manage real-time changes during the fest, and maintain reliable historical records after the fest.

**Primary objective:** Build a practical, reliable MVP that records both what was planned and what actually happened.

## 2. Important Instructions for This Planning Phase

**Remain in Plan Mode. Do not implement anything yet.**

* Do not create or modify project files.
* Do not generate or write application code.
* Do not install packages or dependencies.
* Do not modify existing project configuration.
* First inspect and understand the current workspace and any existing project files without changing them.
* Prepare a complete implementation blueprint based on the requirements below.
* Identify missing information, architectural risks, dependencies, and decisions that need my approval.
* Present the proposed folder structure, database schema, API design, UI pages, workflows, validation rules, and implementation phases.
* If the workspace already contains a project, explain how FestOps would fit into it before proposing changes.
* Wait for my explicit approval before implementing any part of the application.

Do not interpret this prompt as authorization to start coding.

## 3. Recommended Technology Stack

Use the MERN stack unless inspection of the existing workspace reveals a compelling reason to change it.

* **Frontend:** React with Vite.
* **UI:** A consistent, responsive component-based design. Recommend a suitable styling solution after checking the existing project.
* **Backend:** Node.js with Express.
* **Database:** MongoDB with Mongoose.
* **API:** REST APIs with clear request validation and error handling.
* **Authentication:** Secure authentication with role-based authorization enforced on the backend.
* **Schedule import:** Excel/CSV parsing, with manual event creation and editing.
* **Notifications:** In-app notifications initially, with browser push notifications considered optional.
* **Reminders:** A suitable background job or scheduled reminder mechanism.
* **Deployment:** Recommend a suitable deployment approach for the frontend, backend, and database, but do not deploy anything during planning.

Prefer a maintainable architecture, clear separation of responsibilities, reusable components, and technologies appropriate for an MVP. Avoid unnecessary microservices and overengineering.

## 4. User Roles and Permissions

### A. Coordinator / Admin

Can:

* Create and manage fests, venues, events, schedules, and event requirements.
* Import schedules through Excel/CSV.
* Manage team members, roles, skills, availability, and seniority.
* Review and approve suggested assignments.
* Override assignments when necessary, with a recorded reason.
* Manage equipment inventory and approve allocations.
* Resolve scheduling and equipment conflicts.
* Review coverage, footage handovers, backups, and outstanding returns.
* View dashboards, reports, audit logs, and historical records.

### B. Senior / Team Lead

Can:

* View the assigned events and team members they are responsible for.
* Ensure first-year members have a second-year or third-year mentor.
* Coordinate replacements when an event is delayed or a member becomes unavailable.
* Monitor coverage progress and equipment returns.
* Record additional coverage and operational exceptions.
* Report issues to coordinators and take actions permitted by their role.

### C. Team Member

Can:

* View their assigned events, schedules, mentors, and equipment allocations.
* Report availability issues, delays, cancellations, and unexpected coverage.
* Record additional events they actually covered.
* Submit coverage notes and footage handover information.
* Report equipment return, damage, missing items, or backup problems.
* View their own coverage history and pending responsibilities.

Permissions must be checked on the backend, not just by hiding frontend buttons. Team members must not be able to change sensitive records or approve their own actions where approval is required.

## 5. Fest and Event Management

A coordinator should be able to create a fest and register events with the following details:

* Event name and category.
* Date, start time, expected end time, and estimated duration.
* Venue and location.
* Required coverage duration.
* Required deliverables, such as photographs, video, or both.
* Required number of team members.
* Required skills or experience.
* Priority and special instructions.
* Equipment requirements.
* Event status.

Event statuses should include:

* Scheduled
* In Progress
* Completed
* Delayed
* Cancelled

Support Excel/CSV import as well as manual entry. Provide validation and an import preview showing invalid rows, duplicate events, missing fields, and potential conflicts before committing the import.

Allow authorized users to edit event times, venues, requirements, and assignments. Preserve a history of changes rather than silently overwriting important operational decisions.

## 6. Team Assignment and Junior–Senior Mentorship

The application should recommend suitable assignments, but **a coordinator must approve the recommendations before they become confirmed assignments**.

Consider these factors when suggesting assignments:

* Member availability.
* Existing assignments and overlapping event times.
* Event location and travel or setup time, where configured.
* Required photography or videography skills.
* Experience and seniority.
* Workload distribution.
* Junior–senior mentorship requirements.
* Required coverage duration.
* Camera, SD card, and other equipment availability.

Every first-year member assigned to an event must be paired with a second-year or third-year senior for hands-on mentorship.

If a first-year member has no senior assigned, mark the assignment as **Mentor Needed**, notify the responsible team lead, and keep the issue visible until it is resolved. Do not silently treat an unpaired assignment as valid.

Support:

* Suggested assignments.
* Coordinator approval or rejection.
* Manual reassignment.
* Replacement members.
* Multiple members per event.
* Original assignments and replacement history.
* Explicit confirmation of actual contributors after an event.

Do not assume that the person originally assigned to an event is necessarily the person who actually covered it.

## 7. Equipment Inventory and Allocation

Maintain an inventory of equipment such as:

* Cameras.
* Lenses.
* SD cards.
* Batteries.
* Chargers.
* Tripods and other accessories.

Each physical item should have a unique equipment ID. Track relevant details such as item type, model, serial number if available, condition, and notes.

The system must distinguish between equipment reservation, confirmed allocation, physical checkout, and return.

For each allocation, record:

* Equipment ID.
* Assigned holder.
* Event or purpose.
* Checkout time.
* Expected return time.
* Actual return time.
* Issuing person and receiving person.
* Condition at checkout and return.
* Return confirmation and any notes.

Equipment states should distinguish at least:

* Available
* Reserved
* Allocated
* Checked Out
* Return Pending
* Maintenance / Damaged
* Lost, when applicable

Use appropriate transitions so that, for example, a camera marked as checked out cannot simultaneously be treated as available.

A camera and its SD card must be tracked as separate physical assets, even if they are used together.

## 8. Coverage, SD Card Handover, and Backup Tracking

The application must distinguish event completion from coverage completion and footage verification.

For every event, track:

* Planned coverage and assigned members.
* Actual coverage status.
* Actual contributors.
* Actual coverage duration.
* Camera and SD card used.
* Coverage notes.
* Footage handover details.
* Backup status.
* Verification status.
* Exceptions or missing deliverables.

Suggested coverage states:

* Not Started
* In Progress
* Covered
* Partially Covered
* Missed
* Requires Review

Suggested footage lifecycle:

* Not Yet Handed Over
* Handover Pending
* Handed Over
* Backup Pending
* Backed Up
* Verified
* Issue / Recheck Required

The exact transitions should be defined in the implementation plan.

**Important rules:**

* Completing an event must not automatically mark footage as handed over, backed up, or verified.
* Returning a camera must not automatically mark its SD card as returned.
* A written note describing an SD card is not proof that the card was physically handed over.
* Track the current SD card custodian and its return state independently.
* Record who accepted a handover, when it happened, and any associated notes.
* Do not store large photo or video files in the MVP. Track their handover and backup status only.

## 9. Notifications and Dashboard

Create a dashboard relevant to each user's role.

The coordinator dashboard should show:

* Upcoming events and coverage gaps.
* Unapproved assignments.
* First-year members missing mentors.
* Scheduling conflicts.
* Equipment allocation conflicts.
* Overdue returns.
* SD cards awaiting handover.
* Footage awaiting backup or verification.
* Delayed or cancelled events needing action.
* Recent changes and operational exceptions.

Team leads should see the events and members they manage, pending coverage issues, and equipment that needs follow-up.

Team members should see their upcoming assignments, event changes, mentor information, equipment currently held, and pending return or handover tasks.

Support in-app notifications for:

* Upcoming event reminders.
* Schedule or assignment changes.
* Delayed or cancelled events.
* Replacement requests.
* Missing mentorship.
* Equipment checkout and return deadlines.
* Overdue equipment.
* SD card handover reminders.
* Backup or verification issues.

Avoid excessive duplicate notifications. Record notification status and relevant timestamps, and use a suitable scheduled job for reminders.

## 10. Required Operational Edge Cases

Design the data model, workflows, permissions, validations, notifications, and tests to handle each scenario below.

### Case 1: A delayed event conflicts with a member's next event

If a photographer is covering an event that gets delayed and they have another scheduled event, they should prioritize their next assigned event.

The team lead can ask an available team member to cover the delayed event.

The application should:

* Flag the delayed event as needing revised coverage.
* Suggest available replacement members.
* Notify the responsible team lead.
* Preserve the original assignment and record the replacement separately.
* Record who approved the change and why.
* Update the actual coverage record to reflect who covered the event.

Do not automatically cascade changes across other events. Require explicit approval for reassignment.

### Case 2: A first-year member has no senior mentor

Allow the junior to report that they need a mentor.

The system should mark the assignment as Mentor Needed, notify the responsible team lead, and keep it visible until a second-year or third-year mentor is assigned.

### Case 3: The same camera is needed at two simultaneous events

The team lead should be able to identify a free member who can cover the second event, or arrange sequential camera use if the required coverage permits it.

Some small classroom events may require only five to ten minutes of photography. Allow a configurable minimum coverage duration or deliverable requirement so the team can plan whether a camera can be transferred to another event.

The system must:

* Prevent overlapping physical allocations of the same camera.
* Account for travel, setup, and handover buffers where configured.
* Display whether sequential use is feasible.
* Require an authorized exception if the planned minimum coverage cannot be met.

Do not assume that a short visit is sufficient for every event.

### Case 4: An event is cancelled after equipment checkout

An assigned team member, team lead, or coordinator should be able to report a cancellation according to their permissions.

The application should:

* Record the reporter, timestamp, and reason.
* Mark the event as cancelled.
* Keep the equipment checkout open until physical return is confirmed.
* Notify the responsible team lead about outstanding equipment.
* Allow the member to submit a report for another event they covered instead.
* Preserve both the cancellation record and any separate actual coverage record.

Cancelling an event must not automatically return equipment.

### Case 5: The camera is returned but the SD card is still with the photographer

Track camera return and SD card return independently.

Allow a text area for notes describing the SD card contents, handover arrangements, or other relevant details. However, notes must not change the physical return status.

The SD card should remain Return Pending until an authorized handover is explicitly confirmed. The application must identify the current custodian and track the footage lifecycle separately.

### Case 6: SD card corruption or backup failure

Include a pre-use equipment and SD card checklist covering relevant condition, availability, and readiness checks.

However, do not assume that a successful pre-use check guarantees that no failure will occur later.

Provide a way to flag a corrupted card, failed backup, missing footage, or another exception. Notify the appropriate team lead or coordinator, preserve the issue in the audit trail, and prevent the footage from being marked Verified until the issue has been resolved and verification is confirmed.

### Case 7: A member covers an extra or unplanned event

Provide a quick **Unplanned Coverage / Extra Event Report**.

It should allow a team member to submit:

* Event name or a link to an existing event.
* Venue and date/time.
* Actual coverage duration.
* Camera ID and SD card ID, if applicable.
* Individual contributors.
* Coverage notes and deliverables.
* Handover and backup information.
* Any operational issues.

Automatically record the authenticated reporter and submission timestamp.

If the event already exists, link the report to that event. If it was not on the schedule, allow an authorized user to register it as an unscheduled event.

If someone reports on behalf of a team, preserve individual contributor attribution wherever known. Do not credit the reporter as the sole photographer by default.

Provide an appropriate validation or review step before including the report in confirmed coverage history. Once validated, the actual contributors and work should appear in their completed-work histories.

Keep the original assignment intact even when the actual coverage differs.

### Case 8: Two coordinators request the same camera simultaneously

The system must prevent two users from successfully allocating the same physical camera to conflicting assignments.

Use appropriate server-side concurrency control, such as an atomic conditional update or a suitable MongoDB transaction where applicable.

The first valid allocation should succeed. A conflicting request should receive a clear message explaining that the equipment is no longer available, together with its current status and allocation information when the requester has permission to view it.

The implementation plan should distinguish:

* Temporary reservation.
* Confirmed allocation.
* Physical checkout.
* Return.
* Maintenance or damage.

Use idempotent operations where appropriate to prevent duplicate processing after retries. A frontend-only availability check or button lock is not sufficient to prevent simultaneous allocation conflicts.

## 11. Historical Records and Audit Logs

The system must preserve an auditable history before, during, and after the fest.

Record important actions such as:

* Event creation and schedule changes.
* Assignment creation, approval, rejection, and reassignment.
* Mentor assignment changes.
* Equipment reservations, allocations, checkouts, and returns.
* Cancellation and delay reports.
* Actual coverage submissions and corrections.
* SD card handovers.
* Backup and verification status changes.
* Exception reports and their resolutions.

Each audit record should include the actor, action, relevant record, timestamp, and useful before/after information or reason when applicable.

Use a consistent time-handling strategy and display timestamps clearly in the user's relevant timezone.

Do not silently erase important history when assignments or schedules change. Define a controlled process for corrections, with suitable permissions and an audit trail.

Provide filters by fest, event, date, team member, equipment ID, status, and action type. Allow authorized users to export historical logs in CSV format.

## 12. Proposed Data Model

Evaluate and refine the following entities before implementation:

1. **User** — identity, role, seniority/year, skills, availability, and account status.
2. **Fest** — fest details, dates, and organizational settings.
3. **Venue** — venue name, location, setup/travel information where needed.
4. **Event** — schedule, venue, requirements, priority, and event status.
5. **EventAssignment** — planned member assignments, mentorship, approvals, and reassignment history.
6. **Equipment** — unique inventory items, category, condition, and operational status.
7. **EquipmentAssignment** — reservations, allocations, checkout, custody, return, and allocation history.
8. **CoverageRecord** — planned versus actual coverage, contributors, duration, and deliverables.
9. **FootageRecord** — SD card association, custodian, handover, backup, verification, and issue status.
10. **Notification** — recipient, type, related record, delivery/read status, and timestamps.
11. **AuditLog** — important actions, actor, timestamp, and change details.

You may propose additional entities or combine entities where appropriate, but explain the reasoning.

Define relationships, required fields, validation rules, unique constraints, indexes, status transitions, and deletion/archival policies. Avoid storing redundant data unless there is a clear reason.

## 13. API Design

Propose a REST API organized around the application domains, including:

* Authentication and user management.
* Fests and venues.
* Event creation, editing, import, and schedule changes.
* Team availability and assignment recommendations.
* Assignment approvals, mentorship, and reassignment.
* Equipment inventory, reservations, checkout, and returns.
* Actual coverage and unplanned coverage reports.
* SD card handovers and footage tracking.
* Notifications and reminders.
* Dashboards and reports.
* Audit history and CSV exports.

For each important endpoint, specify the HTTP method, route, role permissions, expected inputs, validation, response shape, and possible error cases.

Include proper handling for:

* Unauthorized and forbidden requests.
* Invalid input.
* Duplicate submissions.
* Stale data and concurrent updates.
* Conflicting equipment allocations.
* Missing records.
* Import errors.
* Failed handovers or verification attempts.

Keep authorization and business rules on the server. Do not rely on the frontend to enforce critical constraints.

## 14. Security and Reliability

Include a security plan covering:

* Secure authentication and session/token handling appropriate to the chosen architecture.
* Backend-enforced role-based access control.
* Input validation and sanitization where needed.
* Secure configuration and environment variables.
* Appropriate CORS and security headers.
* Password and sensitive-data protection, if passwords are managed by the application.
* Protection against unauthorized record changes.
* Safe CSV import validation and error handling.
* Rate limiting where appropriate.
* Consistent API errors and logging.
* Database backup and recovery recommendations.
* Audit-log integrity and access restrictions.
* Concurrency-safe equipment allocation.
* Reliable reminder scheduling and duplicate-notification prevention.

Avoid storing secrets in source control. Plan appropriate environment configurations for development and production.

## 15. Suggested Frontend Pages

Plan a clean, mobile-friendly interface with the following pages or modules:

1. Login and account access.
2. Role-specific dashboard.
3. Fest list and fest details.
4. Event schedule, calendar, and event details.
5. Schedule import and validation preview.
6. Team members, skills, and availability.
7. Assignment suggestions and approval screen.
8. Mentor pairing and coverage-gap management.
9. Equipment inventory and equipment details.
10. Equipment reservation, checkout, and return workflow.
11. Actual coverage and extra-event reporting.
12. SD card handover and footage tracking.
13. Notifications and pending tasks.
14. Historical records, audit logs, and exports.
15. User and fest settings.

Use clear visual indicators for conflicts, pending approvals, overdue returns, missing mentors, and footage issues. Do not make the dashboard so crowded that important actions become difficult to find.

Plan for mobile use during a fest, when members may need to check assignments or submit a quick report from their phones.

## 16. MVP Scope and Explicit Exclusions

The MVP must include:

* Authentication and roles.
* Fest, venue, and event management.
* Excel/CSV import and manual entry.
* Assignment suggestions with coordinator approval.
* Junior–senior mentorship enforcement and warnings.
* Equipment inventory and independent camera/SD card tracking.
* Conflict-aware allocation and checkout/return.
* Actual coverage reporting.
* Extra-event reporting.
* Footage handover, backup, and verification tracking.
* In-app notifications and return reminders.
* Audit history and CSV export.
* Role-specific dashboards.
* Handling of all eight operational edge cases above.

Keep these features out of the initial MVP unless a strong dependency makes them necessary:

* PDF schedule extraction.
* Uploading or hosting large photo and video files.
* Full offline operation and synchronization.
* Native mobile applications.
* Advanced AI-based scheduling.
* Complex multi-college or multi-organization tenancy.
* Microservices and other unnecessary infrastructure.
* Browser push notifications, unless they can be added without delaying core functionality.

The application should be online-first and assume reliable internet connectivity.

## 17. Testing Requirements

Include a test plan for:

* Authentication and role permissions.
* Schedule import validation and duplicate handling.
* Assignment overlap detection.
* Junior–senior pairing.
* Event delays, cancellations, and replacements.
* Equipment reservation and checkout rules.
* Simultaneous camera allocation attempts.
* Independent camera and SD card returns.
* Actual coverage attribution.
* Unplanned event reporting.
* Footage handover and backup verification.
* Notification scheduling and duplicate prevention.
* Audit history and export accuracy.
* Invalid and unauthorized API requests.
* Important frontend workflows on desktop and mobile.

Use unit tests for critical business logic, integration tests for API/database behavior, and a small set of end-to-end tests for essential workflows.

## 18. Proposed Implementation Phases

Prepare a dependency-aware implementation roadmap.

**Phase 1 — Workspace review and architecture**

* Inspect the current workspace.
* Identify existing code, configuration, and dependencies.
* Finalize architecture, folder structure, data model, and API contracts.
* Identify decisions requiring approval.

**Phase 2 — Foundation**

* Application setup, configuration, database connection, authentication, roles, validation, and error handling.

**Phase 3 — Fest and schedule management**

* Fests, venues, events, manual event management, and Excel/CSV import.

**Phase 4 — Team planning**

* User profiles, availability, assignment recommendations, approvals, and mentorship requirements.

**Phase 5 — Equipment management**

* Inventory, reservations, checkout, return, custody, and conflict prevention.

**Phase 6 — Actual coverage and footage**

* Coverage reports, extra-event submissions, contributor attribution, SD card handover, backup, and verification.

**Phase 7 — Notifications and operational dashboards**

* Role-specific dashboards, overdue reminders, conflict warnings, and pending-action views.

**Phase 8 — Audit, testing, and release preparation**

* Historical logs, CSV exports, edge-case tests, security review, deployment configuration, and documentation.

Reorder or split these phases if dependencies require it. Identify a small, demonstrable vertical slice that can be built and tested first after implementation is approved.

## 19. Expected Output From Antigravity

Produce a structured planning document containing:

1. A concise product summary and user workflows.
2. Assumptions, open questions, and decisions requiring my approval.
3. A workspace assessment that does not modify files.
4. Recommended architecture and technology choices, with reasons.
5. Proposed frontend and backend folder structure.
6. Detailed data models and relationships.
7. API endpoint specifications and authorization rules.
8. Assignment and equipment-allocation algorithms or pseudocode, without implementing them.
9. Status-transition rules and validations.
10. Workflow diagrams or clearly described workflows for all eight edge cases.
11. UI page descriptions and dashboard requirements.
12. Security, concurrency, notification, and audit-log design.
13. Testing strategy and acceptance criteria.
14. Phased implementation roadmap with dependencies and estimated complexity.
15. Risks, trade-offs, and suggestions for keeping the MVP manageable.

For each of the eight edge cases, explicitly state the expected system behavior and how it will be validated by tests.

Where a requirement is ambiguous, make a clearly labelled recommendation and ask for approval instead of silently making an irreversible assumption.

## 20. Final Instruction

This is the final product-planning specification for FestOps.

**Do not start implementation, create files, install dependencies, or change the workspace.** Review the existing project, prepare the complete implementation plan, point out any unresolved decisions, and wait for my explicit approval to begin coding.
