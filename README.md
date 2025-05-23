# MISHTIKA - Pet AI Project

MISHTIKA is a comprehensive Pet AI project designed to assist pet owners with managing their pets' profiles, schedules, and getting AI-powered advice. It features a user-friendly interface for pet owners and a robust admin panel for system management.

## Features

### User Features
*   **Authentication:** Secure signup, login, and password reset functionality.
*   **Pet Profile Management:** Add, edit, and delete pet profiles, including uploading pet pictures.
*   **AI Chat:** Interact with an AI assistant for pet-related queries. Users can provide context about a specific pet for more tailored advice.
*   **Event Scheduler:** Create, view, edit, and delete schedules for pet activities (e.g., meals, vet visits, medication). Supports recurring events and marking specific occurrences as exceptions.
*   **User Settings:** Update personal profile information (username, age) and change account password.

### Admin Features
*   **Secure Admin Login:** Separate login for administrators.
*   **Admin Dashboard:** View key statistics such as total users, total pets, active users, and a log of recent system activities.
*   **User Management:** View a list of all registered users, delete users (which also removes their associated pets and schedules), and activate/deactivate user accounts.
*   **Pet Management:** View a list of all pets in the system with owner details, and delete pets.
*   **Admin Settings:** Update admin profile information and change the admin account password.

### System Features
*   **Automated Email Reminders:** Sends email reminders to users for their upcoming scheduled events.
*   **Secure Authentication:** Utilizes JSON Web Tokens (JWT) for secure API authentication.
*   **Image Storage:** Pet pictures are uploaded and stored securely on AWS S3.
*   **Responsive Design:** Frontend built with React Bootstrap for a consistent experience across devices.

## Tech Stack

### Frontend
*   **React:** JavaScript library for building user interfaces.
*   **React Router:** For client-side routing.
*   **React Bootstrap:** For UI components and styling.
*   **Axios:** For making HTTP requests to the backend API.
*   **Moment.js:** For date and time manipulation.
*   **CSS Modules:** For component-scoped styling.

### Backend
*   **Node.js:** JavaScript runtime environment.
*   **Express.js:** Web application framework for Node.js.
*   **MongoDB:** NoSQL database for storing application data.
*   **Mongoose:** ODM (Object Data Modeling) library for MongoDB and Node.js.
*   **JSON Web Tokens (JWT):** For user authentication and authorization.
*   **Bcrypt.js:** For hashing passwords.
*   **Nodemailer:** For sending emails (password resets, reminders).
*   **AWS SDK (S3 Client):** For interacting with Amazon S3 for file storage.
*   **OpenAI API:** For powering the AI Chat feature.
*   **Multer:** Middleware for handling `multipart/form-data`, used for file uploads.
*   **`node-cron`:** For scheduling tasks (e.g., reminder emails).
*   **`dotenv`:** For managing environment variables.

### Testing (Backend)
*   **Jest:** JavaScript testing framework.
*   **Supertest:** For testing HTTP assertions.
*   **`mongodb-memory-server`:** For running MongoDB in-memory for tests.
*   **`node-mocks-http`:** For mocking HTTP requests/responses in tests.

### Deployment & CI/CD
*   **Docker:** For containerizing the backend application.
*   **AWS ECR (Elastic Container Registry):** For storing Docker images.
*   **AWS EC2:** For hosting the backend application.
*   **AWS S3:** For hosting the frontend application.
*   **GitHub Actions:** For continuous integration and continuous deployment (CI/CD) automation.

## Project Structure

The project is organized into two main directories:

*   `frontend/`: Contains the React application.
    *   `public/`: Static assets and the main `index.html` file.
    *   `src/`:
        *   `admin/`: Components specific to the admin panel.
        *   `assets/`: Images and other static assets used by components.
        *   `components/`: Reusable UI components (e.g., Header, Footer, NavigationBar).
        *   `pages/`: Top-level page components.
        *   `App.js`: Root component defining routes.
        *   `index.js`: Entry point for the React application.
        *   `index.css`: Global styles.
*   `backend/`: Contains the Node.js/Express.js backend application.
    *   `config/`: Configuration files (e.g., database connection, JWT secret).
    *   `middleware/`: Custom Express middleware (e.g., authentication, admin checks).
    *   `models/`: Mongoose schemas and models.
    *   `routes/`: API route handlers.
    *   `utils/`: Utility functions (e.g., mailer, S3 operations, schedule calculations).
    *   `__tests__/`: Jest test files.
    *   `server.js`: Main entry point for the backend server.
*   `.github/workflows/`: Contains GitHub Actions workflow files for CI/CD.
*   `.dockerignore`: Specifies files to exclude from the Docker build context for the backend.
*   `Dockerfile` ( in `backend/`): Defines the Docker image for the backend.

## Setup and Installation

### Prerequisites
*   Node.js (v20.x recommended)
*   Yarn (or npm)
*   MongoDB instance (  MongoDB Atlas)
*   AWS Account (for S3, ECR, EC2)
*   OpenAI API Key
*   Gmail account with an "App Password" (using Gmail for Nodemailer)

### Backend Setup
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a `.env` file in the `backend` directory and add the following environment variables:
    ```env
    DB_URL=your_mongodb_connection_string
    JWT_SECRET=your_strong_jwt_secret_key
    PORT=3001 # Or any port you prefer

    # Email Configuration (for Nodemailer with Gmail)
    EMAIL_USER=your_gmail_address@gmail.com
    EMAIL_PASS=your_gmail_app_password

    # OpenAI API Key
    OPENAI_API_KEY=your_openai_api_key

    # AWS Configuration
    AWS_ACCESS_KEY_ID=your_aws_access_key_id
    AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
    AWS_REGION=your_aws_s3_bucket_region # e.g., eu-north-1
    S3_BUCKET_NAME=your_s3_bucket_name_for_pet_images
    ```
3.  Install dependencies:
    ```bash
    yarn install
    # or
    # npm install
    ```
4.  Start the backend server:
    ```bash
    yarn start
    # or
    # npm start
    ```
    The backend server should typically run on `http://localhost:3001`.

### Frontend Setup
1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    yarn install
    # or
    # npm install
    ```
3.  Start the frontend development server:
    ```bash
    yarn start
    # or
    # npm start
    ```
    The frontend application should typically run on `http://localhost:3000`.

### Running Backend Tests
1.  Navigate to the `backend` directory.
2.  Ensure your test environment is configured (e.g., `mongodb-memory-server` will be used).
3.  Run the tests:
    ```bash
    yarn test
    # or
    # npm test
    ```

## API Endpoints Overview

The backend exposes the following main API routes:

*   **`/auth`**: User authentication (signup, login, password reset, user settings).
*   **`/pets`**: Pet profile management (CRUD operations).
*   **`/schedules`**: Schedule management (CRUD operations, exceptions).
*   **`/gpt`**: AI Chat functionality.
*   **`/admin`**: Admin-specific operations (dashboard, user management, pet management, admin settings).

## Deployment

This project is configured for deployment to AWS:
*   **Backend:** Deployed as a Docker container on AWS EC2, with the image stored in AWS ECR.
*   **Frontend:** Hosted as a static website on AWS S3.

The CI/CD pipeline is managed by GitHub Actions (see `.github/workflows/deploy.yml`):
*   On pushes to the `main` branch:
    1.  Backend unit tests are run.
    2.  If tests pass, the backend Docker image is built and pushed to AWS ECR.
    3.  The new Docker image is deployed to the AWS EC2 instance.

The EC2 instance is configured to pull the latest image from ECR and run the backend container, exposing it on port 3001 (or as configured). Environment variables for the backend container are managed via GitHub Secrets and passed during the SSH deployment step.

---

This should give you a solid foundation for your project's README! You might want to add more specific details or sections as your project evolves.
