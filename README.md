<div align="center">

# MISHTIKA

**A comprehensive, AI-powered platform for managing pet profiles, scheduling, and health advice.**

[![Node.js](https://img.shields.io/badge/Node.js-v20.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18.2-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-success.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

</div>

---

## What is MISHTIKA?

> **Note:** This project represents the original version deployed on AWS from January 2024 to May 2024. The project has since been migrated and is now hosted on Render. You can find the active Render repository here: [pet-ai-render](https://github.com/Anasmtaweh/pet-ai-render).

MISHTIKA is a full-stack web application designed to assist pet owners with managing their pets' profiles, schedules, and getting AI-powered advice. It features a user-friendly React frontend and a robust Node.js/Express backend. With an integrated OpenAI-driven assistant, pet owners can get personalized care guidance, while administrators can moderate users and view system statistics.

---

## Features

- **Authentication** — Secure signup, login, and robust password reset workflows using JWT.
- **Pet Profile Management** — Add, edit, and delete detailed pet profiles, including securely storing photos on AWS S3.
- **AI Chat Agent** — Interact with an AI assistant for pet-related queries, including localized product recommendations tailored for users in Lebanon (powered by OpenAI).
- **Event Scheduler** — Create, view, edit, and delete pet schedules (meals, vet visits) with recurring event support.
- **Automated Email Reminders** — Background CRON jobs send perfectly timed email reminders for upcoming scheduled events.
- **Secure Admin Dashboard** — Separate admin login for moderating overall platform statistics, user lists, and pet registries.

---

## Quick Start

### Prerequisites

- Node.js (v20.x recommended)
- Yarn or npm
- MongoDB instance (MongoDB Atlas recommended)
- AWS Account (for S3 image storage)
- OpenAI API Key
- Gmail account with an "App Password" (for Nodemailer)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Anasmtaweh/pet-ai-project.git
cd pet-ai-project

# 2. Setup Backend
cd backend
cp .env.example .env  # Add your DB, JWT, OpenAI, AWS, and Email credentials
yarn install
yarn start            # Runs on http://localhost:3001

# 3. Setup Frontend
cd ../frontend
yarn install
yarn start            # Runs on http://localhost:3000
```

### First Run

1. Open your browser at `http://localhost:3000`
2. Create an account via the **Signup** page
3. Log in and navigate to the **Pet Profile** section to add your first pet
4. Go to **AI Chat** and ask for personalized pet care advice!

---

## Architecture

```text
pet-ai-project/
├── backend/                # Node.js Express API
│   ├── config/             # Environment configs (JWT, DB connects)
│   ├── middleware/         # Auth, Admin validation middleware
│   ├── models/             # Mongoose schemas (User, Pet, Schedule)
│   ├── routes/             # API definition controllers
│   ├── utils/              # S3 uploading, Emailing, Schedule calculations
│   ├── __tests__/          # Jest unit & integration tests
│   ├── server.js           # Server entry point & CRON scheduler
│   └── Dockerfile          # Backend containerization config
│
├── frontend/               # React User Interface
│   ├── public/             # Static assets (images, indexes)
│   └── src/
│       ├── admin/          # Components for the Admin Dashboard
│       ├── components/     # Reusable UI (Navigation, Headers)
│       ├── pages/          # Core pages (Login, PetForm, Scheduler, Chat)
│       └── App.js          # Client-side routing orchestrator
│
└── .github/workflows/      # GitHub Actions for CI/CD Deployment
```

---

## Tech Stack

| Domain | Technology |
|---|---|
| **Frontend** | React (v18), React Router, React Bootstrap, React Big Calendar, React Icons, Axios |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB, Mongoose ODM |
| **Services** | AWS SDK (S3), OpenAI API, Nodemailer, node-cron, Moment.js |
| **Security** | JSON Web Tokens (JWT), Bcrypt.js |
| **Testing** | Jest, Supertest, mongodb-memory-server |
| **DevOps** | Docker, AWS EC2, AWS ECR, GitHub Actions |

---

## Deployment & CI/CD

> **Historical Note:** This AWS deployment architecture was active from January 2024 to May 2024. For the current active deployment, please see the [pet-ai-render](https://github.com/Anasmtaweh/pet-ai-render) repository.

This project is configured for seamless deployment to AWS using GitHub Actions:
- **Frontend** is hosted as a highly-available static website on AWS S3.
- **Backend** is deployed as a Docker container on an AWS EC2 instance.
- **CI/CD Pipeline** automatically triggers on pushes to the `main` branch, running Jest backend tests before building and pushing the Docker image to ECR.

---

## Author

Built by [Anas Mtaweh](https://github.com/Anasmtaweh) 

- GitHub: [Anasmtaweh](https://github.com/Anasmtaweh)
- LinkedIn: [linkedin.com/in/anas-mtaweh-a02806218](https://www.linkedin.com/in/anas-mtaweh-a02806218)
