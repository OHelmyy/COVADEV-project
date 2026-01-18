# COVADEV
**AI-Driven BPMN Validation & Developer Evaluation System**


## 📌 Overview

**COVADEV** is a Django-based web application that validates whether a software implementation **semantically aligns** with a given **BPMN (Business Process Model and Notation)** specification.

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

* BPMN XML upload and parsing
* Source code upload and analysis
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
BPMN XML + Source Code
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
Dashboard & Reports
```


## 🧱 Tech Stack

* **Backend:** Django (Python)
* **AI / NLP:** Transformer-based sentence embeddings
* **Similarity:** Cosine similarity
* **Frontend:** Django templates (HTML / CSS / JS)
* **Database:** SQLite (MVP)
* **Version Control:** Git & GitHub


## 📁 Repository Structure

```
covadev/
├── config/               # Django project configuration
├── apps/
│   ├── accounts/         # Authentication & roles
│   ├── projects/         # Project & upload management
│   ├── analysis/         # BPMN parsing, AI, metrics
│   ├── reports/          # Dashboards & reports
│   └── common/           # Shared utilities
├── templates/            # HTML templates
├── static/               # CSS / JS assets
├── media/                # Uploaded files (gitignored)
├── docs/                 # Architecture & documentation
├── tests/                # Unit & integration tests
├── manage.py
├── requirements.txt
└── README.md
```


## 🚀 Setup & Run

### 1️⃣ Clone Repository

```bash
git clone <https://github.com/OHelmyy/COVADEV.git>
cd covadev
```

### 2️⃣ Create Virtual Environment

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Run Migrations

```bash
python manage.py migrate
```

### 5️⃣ Create Admin User

```bash
python manage.py createsuperuser
```

### 6️⃣ Start Server

```bash
python manage.py runserver
```

Access the app at:
➡️ `http://127.0.0.1:8000`

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



