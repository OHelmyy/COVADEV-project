# COVADEV
**AI-Driven BPMN Validation & Developer Evaluation System**


## 📌 Overview

**COVADEV** is a full-stack web application that validates whether a software implementation **semantically aligns** with a given **BPMN (Business Process Model and Notation)** specification.

The system bridges the gap between **business process design** and **software implementation** by using **AI and NLP-based semantic similarity techniques** to:

* match BPMN tasks with source code elements,
* detect missing or extra functionality,
* compute alignment and quality metrics,
* and evaluate developer performance objectively.

This repository contains the **final, clean, and actively developed implementation** of the COVADEV graduation project.


## 🎯 Project Objectives

* Validate semantic alignment between BPMN models and code
* Reduce ambiguity between business and development teams
* Automate process-to-code conformance checking
* Provide clear, explainable validation reports
* Enable fair and metric-based developer evaluation


## 🧠 System Capabilities

### Core Features

* BPMN XML upload, parsing, and visualization (React Flow & BPMN-js)
* Source code upload and analysis via GitHub Integration
* Task tracking and assignment mapping
* Semantic embedding and similarity matching
* Traceability mapping (BPMN ↔ Code)
* Detection of:

  * matched tasks
  * missing BPMN tasks
  * extra code functionality
* Metrics calculation:

  * Alignment %
  * Precision
  * Recall
  * F1-score
* Developer-level evaluation and comparison
* Interactive dashboard and reports
* Exportable results (HTML / CSV)


## 🏗️ High-Level Architecture

```
BPMN XML + Source Code (GitHub / Local)
        │
        ▼
Parsing & Code Analysis
        │
        ▼
Semantic Embedding Engine
        │
        ▼
Similarity & Traceability Engine
        │
        ▼
Metrics & Developer Evaluation
        │
        ▼
Dashboard & Reports (React Frontend)
```


## 🧱 Tech Stack

* **Backend:** Django (Python) & Django REST Framework
* **Frontend:** React 19, TypeScript, Vite, React Flow, BPMN-js
* **AI / NLP:** Transformer-based sentence embeddings
* **Similarity:** Cosine similarity
* **Database:** SQLite (MVP)
* **Version Control & Integrations:** Git & GitHub API


## 📁 Repository Structure

```
covadev/
├── config/               # Django project configuration
├── apps/                 # Django backend applications
│   ├── accounts/         # Authentication & roles
│   ├── analysis/         # BPMN parsing, AI, metrics
│   ├── api/              # RESTful API endpoints
│   ├── github_integration/# GitHub webhooks and API
│   ├── projects/         # Project & upload management
│   ├── reports/          # Dashboards & reports
│   └── task_management/  # Developer tasks & assignments
├── frontend/             # React SPA (TypeScript, Vite)
│   ├── public/           # Static assets
│   └── src/              # React components & hooks
├── media/                # Uploaded files (gitignored)
├── tests/                # Unit & integration tests
├── manage.py
├── requirements.txt
└── README.md
```


## 🚀 Setup & Run

### 1️⃣ Clone Repository

```bash
git clone https://github.com/OHelmyy/COVADEV-project.git
cd COVADEV-project
```

### 2️⃣ Backend Setup (Django)

```bash
# Create Virtual Environment
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate
# Activate it (macOS / Linux)
source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt

# Run Migrations
python manage.py migrate

# Start Django Server
python manage.py runserver
```
The API will be running at `http://127.0.0.1:8000`.

### 3️⃣ Frontend Setup (React/Vite)

Open a **new terminal tab/window**:

```bash
cd frontend
npm install
npm run dev
```
The React frontend will be accessible at the URL provided by Vite (typically `http://localhost:5173`).

---

## 🔄 Git Workflow

### Branches

* `main` → stable, demo-ready
* `develop` → integration branch
* `feature/*` → development branches

### Rules

* No direct commits to `main`
* One feature per branch
* Pull requests required
* Clear commit messages


## 📊 Evaluation Metrics

* Alignment Percentage
* Precision
* Recall
* F1 Score
* Matched / Missing / Extra counts
* Developer performance score


# 🎓 Academic Context

This project is developed as part of a **graduation requirement** and follows:

* clean architecture principles,
* reproducible evaluation logic,
* explainable AI practices,
* and collaborative software engineering workflows.

Early experimental work is archived separately and **not included in this repository**.



# 📬 Contact

For issues or contributions, please use **GitHub Issues**.
