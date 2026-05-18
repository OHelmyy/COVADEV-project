# COVADEV: Task Management & GitHub Integration Testing Guide

This document outlines the newly added features and provides structured, clean testing scenarios for your team to verify the changes.

---

## 1. Features Implemented

* **Evaluator Dashboard Permissions**
  * Granted full task management and assignment permissions to the project's designated Evaluator, resolving previous access restrictions.
  * *Component:* `apps/task_management/api.py`

* **Developer Task Serialization**
  * Enriched the developer task list API response with nested BPMN task data to prevent frontend rendering errors.
  * *Component:* `apps/task_management/api.py`

* **Task Assignment & Target Branch Preview**
  * Implemented an assignment creation form that slugifies task names and generates real-time target Git branch previews following the `task/{task-slug}-{developer}` format.
  * *Component:* `TaskManagementTab.tsx`, `TaskAssignmentRow.tsx`

* **Direct Pull Request Merging Service**
  * Added a backend service layer and API controller allowing evaluators to merge GitHub pull requests directly from the COVADEV workspace.
  * *Component:* `github_service.py`, `views.py`, `urls.py`, `github.ts`

* **Constrained Code Viewer Layout**
  * Implemented an "Accept & Merge PR" action button inside the Pull Request card.
  * Updated CSS Grid columns with strict `minmax(0, 1fr)` track parameters to force wide source code snippets to scroll horizontally instead of breaking page bounds.
  * *Component:* `GitHubTab.tsx`

* **Automated PR URL Autocomplete**
  * Automated pull request URL construction based on repository base paths and user-entered PR numbers, removing redundant input fields from the submission forms.
  * *Component:* `assignment_service.py`, `MyTasksTab.tsx`, `MyTasksPage.tsx`

* **Role-Based Tab Visibility**
  * Secured tab rendering to restrict the GitHub tab exclusively to Admin and Evaluator roles.
  * *Component:* `projectDetail.ts`, `useProjectDetailData.ts`

* **Dynamic Status Metric Cards**
  * Added live counters at the top of the Task Management dashboard tracking Unassigned, Assigned, and Finished task counts.
  * *Component:* `TaskManagementTab.tsx`

---

## 2. Test Execution Scenarios

Before starting, ensure you have credentials for:
1. **Admin**
2. **Evaluator** (assigned to the project)
3. **Developer** (enrolled in the project)

---

### Scenario A: Role-Based Access Control
1. Log in to the application as a **Developer**.
2. Navigate to the project detail page.
3. *Verification:* Verify that the "GitHub" and "Task Management" tabs are hidden. Only the "My Tasks" tab should be visible.
4. Log in as an **Evaluator** or **Admin**.
5. Navigate to the same project page.
6. *Verification:* Verify that all tabs (Overview, Uploads, Task Management, GitHub, etc.) are visible.

---

### Scenario B: Task Assignment & Git Branch Preview
1. Log in as an **Evaluator**.
2. Open the project page and navigate to the **Task Management** tab.
3. Select an available BPMN task (`🟢 [Available]`) and select a developer from the dropdowns.
4. *Verification:* Confirm that the preview card displays the exact Git branch path correctly slugified.
5. Check the "Auto-create GitHub branch" option and click "Assign BPMN Task".
6. *Verification:*
   * The assignment is added to the active table below.
   * If GitHub is connected, check the remote repository to ensure the branch is created.
   * The dashboard metrics at the top update their values instantly.

---

### Scenario C: Developer Task Submission
1. Log in as the assigned **Developer**.
2. Navigate to the project's **My Tasks** tab.
3. Click "Start Task" to change the status to `IN_PROGRESS`.
4. Once you have pushed commits to GitHub and created a pull request, click "Submit Work".
5. Choose "Submit via GitHub PR".
6. *Verification:* Confirm that the form only requests a **PR Number** (manual PR URL entry is removed).
7. Enter the PR Number, fill out the note, and click "Submit".
8. *Verification:* Confirm the status updates to `SUBMITTED` and the PR link is automatically generated.

---

### Scenario D: PR Acceptance & Direct Merging
1. Log in as the **Evaluator**.
2. Navigate to the **GitHub** tab.
3. Select the pull request submitted by the developer.
4. *Verification:*
   * Click a modified file and ensure that the code viewer handles long lines by scrolling horizontally.
   * Confirm the "Accept & Merge PR" button is visible and active next to the link.
5. Click **Accept & Merge PR**.
6. *Verification:*
   * Check your GitHub repository to confirm the PR was successfully merged.
   * Verify that the task status inside COVADEV transitions to `FINISHED` / `MERGED`.
   * Verify that the "Finished Tasks" metrics card at the top of the Task Management tab increases by one.
