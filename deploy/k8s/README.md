# Kubernetes Deployment Templates

Production-ready Kubernetes manifests for self-hosting OpenPencil.

## Components

- **webapp-deployment.yaml** — Web UI: fetches a release tarball, builds with Bun, serves via nginx with TLS
- **mcp-deployment.yaml** — MCP HTTP server: installs `@open-pencil/mcp` from npm, runs behind an nginx TLS sidecar with bearer auth
- **nginx-configmap.yaml** — Nginx reverse proxy config template for the MCP server

## Quick Start

### Prerequisites

- A Kubernetes cluster (1.25+)
- A TLS certificate Secret (e.g. from cert-manager)
- A Secret containing a bearer token for MCP auth
- A PersistentVolumeClaim for MCP file storage

### Deploy the Web UI

```bash
export OPENPENCIL_VERSION=0.9.0
export OPENPENCIL_NAMESPACE=openpencil
export TLS_SECRET_NAME=openpencil-tls
export NGINX_CONFIGMAP=openpencil-nginx-config

kubectl create namespace "$OPENPENCIL_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
envsubst < deploy/k8s/webapp-deployment.yaml | kubectl apply -f -
```

### Deploy the MCP Server

```bash
export MCP_NAMESPACE=mcp
export MCP_PACKAGE_VERSION=0.8.0
export MCP_AUTH_SECRET=mcp-openpencil-auth
export MCP_TLS_SECRET=mcp-openpencil-tls
export MCP_NGINX_CONFIGMAP=mcp-openpencil-nginx
export MCP_PVC_NAME=mcp-openpencil-data
export MCP_SERVER_NAME=mcp-openpencil.example.com

kubectl create namespace "$MCP_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
envsubst < deploy/k8s/nginx-configmap.yaml | kubectl apply -f -
envsubst < deploy/k8s/mcp-deployment.yaml | kubectl apply -f -
```

### Create Supporting Resources

The templates reference Secrets and PVCs that you must create yourself:

```bash
# MCP bearer auth secret
kubectl -n "$MCP_NAMESPACE" create secret generic "$MCP_AUTH_SECRET" \
  --from-literal=bearer_token="$(openssl rand -base64 32 | tr '+/=' '._-')"

# MCP data PVC (adjust storageClassName for your cluster)
kubectl -n "$MCP_NAMESPACE" apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: $MCP_PVC_NAME
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
EOF
```

## Image Options

All image references can be overridden via environment variables. Defaults use standard upstream images.

For hardened container images, [Docker Hardened Images (DHI)](https://docs.docker.com/dhi/) provides security-hardened variants:

```bash
export NGINX_IMAGE=dhi.io/nginx:1.29.5        # webapp
export MCP_NGINX_IMAGE=dhi.io/nginx:1.29.5    # MCP sidecar
```

DHI images require a Docker account and `docker login dhi.io` (free, no subscription needed).

## Security Notes

- All containers run as non-root with dropped capabilities
- Root filesystems are read-only where possible
- Init containers that need write access run as root but with `allowPrivilegeEscalation: false` and all capabilities dropped
- The nginx sidecar injects the bearer token via envsubst at startup; the token never appears in ConfigMaps
- `automountServiceAccountToken: false` prevents unnecessary API server access
