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
- [Node.js](https://nodejs.org/) 22 or newer
- [pnpm](https://pnpm.io/installation) 11.21.0
- [Encore CLI](https://encore.dev/docs/install)

## Getting Started

### 1. Clone the Repository
First, clone the project repository to your local machine.
```bash
# Replace with your actual repository URL
git clone https://github.com/your-username/paletki.git
cd paletki
```

### 2. Install Dependencies

On Windows, install the version of pnpm used by this repository:

```powershell
npm install --global pnpm@11.21.0
pnpm --version
```

The version command should print `11.21.0`. Then install all frontend and backend
dependencies from the project root:

```powershell
pnpm install
```

If PowerShell blocks `npm.ps1` or `pnpm.ps1` because script execution is disabled,
use their `.cmd` launchers instead:

```powershell
npm.cmd install --global pnpm@11.21.0
pnpm.cmd install
pnpm.cmd dev
```

## Local Development

Create your local environment file before starting the application:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env`. Fill in the LDAP,
FIS and database values in `.env`; this file is ignored by Git.

Start the frontend and backend together from the project root:

```bash
pnpm dev
```

The frontend is available at `http://localhost:3000` and the backend at
`http://localhost:4000`. Both processes run in the same terminal. Press
`Ctrl+C` once to stop them.

To run only one part of the application, use:

```bash
pnpm --filter @paletki/frontend dev
pnpm --filter @paletki/backend dev
```

## Building the Application

### LDAP departments and directory lookup

Access is based on the LDAP `department` attribute, not AD `memberOf` groups or the legacy role field:

| Department matches | Available views |
| --- | --- |
| `LDAP_IT_DEPARTMENTS` | All views, including the IT-only LDAP directory |
| `LDAP_ME_DEPARTMENTS` (without IT) | All views and pallet/project management, except the LDAP directory |
| `LDAP_UR_DEPARTMENTS` only | Maintenance only (also the landing page) |
| Neither list / operator session | Operator scanner and live monitor |

Set `LDAP_UR_DEPARTMENTS` and `LDAP_ME_DEPARTMENTS` to the exact department names from your directory, separated by semicolons. Whitespace and letter case are normalized. Empty lists grant no access. Overlapping matches use this precedence: IT → ME → UR; only IT can access the directory endpoint. UR can service damaged pallets or pallets requiring washing, including reporting damage and returning serviced pallets to production. Administrative mutations and audit exports require IT or ME. Existing public pallet reads and the FIS integration are unchanged; these view restrictions are not a data-isolation boundary.

The directory screen (`/directory`) uses the IT-protected `POST /auth/directory/lookup` endpoint. Configure `LDAP_LOOKUP_BIND_USER` (UPN or full DN) and `LDAP_LOOKUP_BIND_PASSWORD` for a least-privilege directory **read-only** account on the backend. It reuses `LDAP_URL`, `LDAP_SEARCH_BASE`, certificate verification and timeouts. No user login passwords are saved. Do not put these credentials in frontend/VITE variables or commit them to Git; provide them through your deployment's secret configuration.

Lookup returns the department, job title and direct AD groups (`memberOf`, full distinguished names). Nested memberships and the primary group are not included; server-truncated results are marked incomplete. These groups are informational — access uses the department lists.

Restart/redeploy the backend after changing environment variables and sign in again to refresh the frontend's access flags. This update requires rebuilding both backend and frontend; sessions saved by older frontends require signing in again. No database migration is needed.

To prepare the application for deployment, you need to build both the backend and frontend components.

### 1. Build Backend Service
The backend is built using Encore, which packages it into a Docker image. Run the following command from the project root:
```bash
pnpm install
pnpm build:docker
```
This command creates a Docker image named `paletki-dev` with the tag `latest`.

The workspace uses pnpm's hoisted linker because Encore's Docker builder cannot copy Windows junction points. If dependencies were previously installed with the default isolated linker, run `pnpm install --force` once before building the image.

### 2. Build Frontend Assets
Build the static assets for the frontend application:
```bash
pnpm build
```
This command will typically create a `build` or `dist` directory with the compiled frontend code.

## Running the Application

With the backend and frontend built, you can run the entire application stack using Docker Compose.

```bash
docker-compose up -d
```

The frontend is exposed on HTTP port 80. To use a hostname such as
`plblo-paletki.borgwarner.net`, create a DNS `A` record pointing that hostname
to the IPv4 address of the machine running Docker. For testing on one computer,
the same mapping can be added to the local Windows `hosts` file instead.

This command starts all the services defined in your `docker-compose.yml` file (e.g., your backend service, a web server for the frontend, databases, etc.).

You should now be able to access the application in your browser at the configured address (e.g., `http://localhost:8080`).
