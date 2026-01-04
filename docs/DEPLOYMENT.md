# 🚀 MoLOS Deployment Guide

This guide provides instructions for deploying MoLOS in production environments using Docker, Docker Compose, or Kubernetes.

## 📋 Prerequisites

- **Bun**: Recommended for local development and building.
- **Docker**: Required for containerized deployments.
- **Better Auth Secret**: You must generate a secret for authentication.
  ```bash
  openssl rand -base64 32
  ```

---

## 🐳 Docker Compose (Recommended for Single Server)

The easiest way to deploy MoLOS is using Docker Compose.

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-username/MoLOS.git
    cd MoLOS
    ```

2.  **Create a `.env` file**:

    ```bash
    BETTER_AUTH_SECRET=your_generated_secret
    # Or use a secret file (Docker/K8s):
    # BETTER_AUTH_SECRET_FILE=/run/secrets/better_auth_secret
    ```

3.  **Start the application**:
    ```bash
    docker compose up -d
    ```

MoLOS will be available at `http://localhost:3000`. Data is persisted in the `molos_data` volume.

---

## ☸️ Kubernetes Deployment

For scalable environments, use the provided Kubernetes manifests.

1.  **Create a secret for Better Auth**:

    ```bash
    kubectl create secret generic molos-secrets --from-literal=better-auth-secret=your_generated_secret
    ```

2.  **Apply the manifests**:

    ```bash
    kubectl apply -f kubernetes/pvc.yaml
    kubectl apply -f kubernetes/deployment.yaml
    kubectl apply -f kubernetes/service.yaml
    kubectl apply -f kubernetes/ingress.yaml
    ```

3.  **Configure Ingress**:
    Edit `kubernetes/ingress.yaml` to match your domain and SSL configuration (Cert-manager recommended).

---

## 📦 Versioning & Releases

MoLOS uses a semi-automated versioning system.

### Creating a New Release

Run the release script from the `main` branch:

```bash
./scripts/release.sh [patch|minor|major]
```

This script will:

1.  Bump the version in `package.json`.
2.  Update `CHANGELOG.md`.
3.  Create a Git tag.
4.  Push to GitHub.

### CI/CD Pipeline

When a new tag (e.g., `v1.0.1`) is pushed, a GitHub Action automatically:

1.  Builds the production Docker image.
2.  Publishes it to **GitHub Container Registry (GHCR)**.

---

## 🛠️ Maintenance & Observability

### Health Checks

MoLOS provides a health check endpoint at `/ui/MoLOS-Health`. This endpoint verifies:

- Application uptime.
- Database connectivity.
- System timestamp.

It is used by the Kubernetes liveness and readiness probes.

### Database Backups

A professional backup script is provided at `scripts/backup-db.sh`. It:

- Performs a safe online backup using `sqlite3 .backup`.
- Compresses the backup using `gzip`.
- Automatically cleans up backups older than 7 days.

**To run a manual backup (Docker):**

```bash
docker exec molos /app/scripts/backup-db.sh
```

### Security

- **Non-root user**: The Docker container runs as the `bun` user for enhanced security.
- **CI/CD**: Every push to `main` or a Pull Request triggers a full suite of Linting, Type Checking, and Unit Testing.

### External Modules

External modules are refreshed on every container restart. To add new modules, mount them to the `/app/external_modules` directory in your container.
