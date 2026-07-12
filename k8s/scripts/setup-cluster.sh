#!/bin/bash
#
# setup-cluster.sh
#
# Bootstraps a fresh Ubuntu EC2 instance into a ready-to-deploy k3s cluster
# with ingress and automatic SSL, so the app can be deployed with a single
# `kubectl apply` afterward.
#
# Components installed:
#   - k3s (pinned version)
#   - Helm
#   - NGINX Ingress Controller
#   - cert-manager
#   - Let's Encrypt ClusterIssuer
#
# After this script finishes:
#   kubectl apply -f k8s/namespace.yaml
#   kubectl apply -R -f k8s/
#

set -e

# -----------------------------------------------------------------------------
# Versions (Pin everything for reproducible environments)
# -----------------------------------------------------------------------------
K3S_VERSION="v1.34.1+k3s1"

echo "==> Updating system..."
sudo apt update && sudo apt upgrade -y

# -----------------------------------------------------------------------------
# Install k3s
# -----------------------------------------------------------------------------
echo "==> Installing k3s ${K3S_VERSION} (Traefik disabled)..."

curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="${K3S_VERSION}" \
  sh -s - --disable traefik

# -----------------------------------------------------------------------------
# Configure kubectl
# -----------------------------------------------------------------------------
echo "==> Setting up kubectl..."

mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$(id -u)":"$(id -g)" ~/.kube/config

export KUBECONFIG="$HOME/.kube/config"

grep -qxF 'export KUBECONFIG=$HOME/.kube/config' ~/.bashrc || \
echo 'export KUBECONFIG=$HOME/.kube/config' >> ~/.bashrc

# -----------------------------------------------------------------------------
# Wait for node
# -----------------------------------------------------------------------------
echo "==> Waiting for Kubernetes node..."

until kubectl get nodes | grep -q " Ready"; do
    sleep 3
done

kubectl get nodes

# -----------------------------------------------------------------------------
# Install Helm
# -----------------------------------------------------------------------------
echo "==> Installing Helm..."

curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

helm version

# -----------------------------------------------------------------------------
# Install NGINX Ingress
# -----------------------------------------------------------------------------
echo "==> Installing NGINX Ingress..."

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace

echo "==> Waiting for NGINX Ingress..."

kubectl wait \
    --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=180s

# -----------------------------------------------------------------------------
# Install cert-manager
# -----------------------------------------------------------------------------
echo "==> Installing cert-manager..."

helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --create-namespace \
    --set installCRDs=true

echo "==> Waiting for cert-manager..."

kubectl wait \
    --namespace cert-manager \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/instance=cert-manager \
    --timeout=180s

# -----------------------------------------------------------------------------
# Apply ClusterIssuer
# -----------------------------------------------------------------------------
echo "==> Applying ClusterIssuer..."

kubectl apply -f k8s/cluster-issuer.yaml

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
echo ""
echo "=========================================================="
echo "✅ Cluster bootstrap completed successfully!"
echo ""
echo "Installed:"
echo "  • k3s ${K3S_VERSION}"
echo "  • Helm"
echo "  • NGINX Ingress"
echo "  • cert-manager"
echo ""
echo "Next:"
echo "  kubectl apply -f k8s/namespace.yaml"
echo "  kubectl apply -R -f k8s/"
echo "=========================================================="