# Paletki Project

"Paletki" is a comprehensive web application designed to streamline the management and tracking of physical pallets within a production or logistics environment. The system allows users to register new pallets, monitor their lifecycle, track usage cycles, and manage maintenance schedules. By providing a centralized database and an intuitive user interface, the project aims to reduce manual errors, improve operational efficiency, and provide clear visibility into the status and history of each pallet.

## Architecture Overview

The application is built on a modern, decoupled architecture that separates the frontend user interface from the backend business logic. This design enhances scalability, maintainability, and allows for independent development and deployment of each component.

### Frontend
The frontend is a single-page application (SPA) responsible for rendering the user interface and interacting with the backend via a REST API. It provides a user-friendly experience for viewing pallet data, registering new pallets, and managing their status.

### Backend
The backend is developed using the **Encore** framework, which simplifies the creation of scalable, cloud-native services. It is structured as a set of microservices, each responsible for a distinct domain of the application:

- **`pallet` Service**: The core service that handles all CRUD (Create, Read, Update, Delete) operations for pallets. It manages pallet data, including unique IDs, project associations, model types, cycle counts, and status (e.g., Active, Blocked). It also maintains a detailed audit log for each pallet's history.
- **`dashboard` Service**: Provides aggregated data and analytics for visualization on the frontend dashboard. This service might calculate statistics like the number of active pallets, maintenance needs, or overall usage trends.
- **`maintenance` Service**: Manages the maintenance lifecycle of pallets. It can be used to schedule maintenance tasks, record completed work, and update a pallet's status based on its condition.

This microservices architecture ensures that the system is resilient and that individual components can be updated or scaled without impacting the entire application.

---

This document provides instructions on how to set up, build, and run the "paletki" project for local development and deployment.

## Prerequisites

Before you begin, ensure you have the following tools installed on your system:
- [Docker](https://www.docker.com/get-started) & Docker Compose
- [Node.js](https://nodejs.org/) (which includes npm)
- [Encore CLI](https://encore.dev/docs/install)

## Getting Started

### 1. Clone the Repository
First, clone the project repository to your local machine.
```bash
# Replace with your actual repository URL
git clone https://github.com/your-username/paletki.git
cd paletki
```

### 2. Install Frontend Dependencies
Navigate to the frontend directory (if applicable) and install the required npm packages.
```bash
# If your frontend code is in a sub-directory, e.g., 'frontend/'
# cd frontend/
npm install
```

## Building the Application

To prepare the application for deployment, you need to build both the backend and frontend components.

### 1. Build Backend Service
The backend is built using Encore, which packages it into a Docker image. Run the following command from the project root:
```bash
encore build docker --config infra.config.json paletki-dev:latest
```
This command creates a Docker image named `paletki-dev` with the tag `latest`.

### 2. Build Frontend Assets
Build the static assets for the frontend application:
```bash
npm run build
```
This command will typically create a `build` or `dist` directory with the compiled frontend code.

## Running the Application

With the backend and frontend built, you can run the entire application stack using Docker Compose.

```bash
docker-compose up
```

This command starts all the services defined in your `docker-compose.yml` file (e.g., your backend service, a web server for the frontend, databases, etc.).

You should now be able to access the application in your browser at the configured address (e.g., `http://localhost:8080`).