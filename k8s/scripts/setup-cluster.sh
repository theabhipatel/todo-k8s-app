#!/bin/bash
#
# setup-cluster.sh
#
# Bootstraps a fresh Ubuntu EC2 instance into a ready-to-deploy k3s cluster
# with ingress and automatic SSL, so the app can be deployed with a single
# `kubectl apply` afterward. Run this once per new server.
#
# Steps performed:
#   1. Update system packages (apt update && upgrade)
#   2. Install k3s, with the built-in Traefik ingress disabled
#      (we use nginx-ingress instead, installed in step 5)
#   3. Configure kubectl to work without sudo (copies k3s.yaml to ~/.kube/config)
#   4. Wait for the node to report Ready
#   5. Install Helm (needed to install nginx-ingress and cert-manager)
#   6. Install the nginx-ingress controller via Helm, and wait for its pod
#      to be ready
#   7. Install cert-manager via Helm, and wait for its pods to be ready
#   8. Apply k8s/cluster-issuer.yaml, registering Let's Encrypt as the
#      certificate authority cert-manager will request SSL certs from
#
# After this script finishes, deploy the app itself with:
#   kubectl apply -f k8s/namespace.yaml
#   kubectl apply -R -f k8s/
#
set -e

echo "==> Updating system..."
sudo apt update && sudo apt upgrade -y

echo "==> Installing k3s (Traefik disabled, using nginx-ingress instead)..."
curl -sfL https://get.k3s.io | sh -s - --disable traefik

echo "==> Setting up kubectl access without sudo..."
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$(id -u)":"$(id -g)" ~/.kube/config
export KUBECONFIG=~/.kube/config
grep -qxF 'export KUBECONFIG=~/.kube/config' ~/.bashrc || echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc

echo "==> Waiting for node to be Ready..."
until kubectl get nodes | grep -q " Ready"; do
  sleep 3
done
kubectl get nodes

echo "==> Installing Helm..."
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

echo "==> Installing nginx-ingress controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

echo "==> Waiting for nginx-ingress pod to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

echo "==> Installing cert-manager..."
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

echo "==> Waiting for cert-manager pods to be ready..."
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=180s

echo "==> Applying ClusterIssuer (Let's Encrypt prod)..."
kubectl apply -f k8s/cluster-issuer.yaml

echo ""
echo "==================================================="
echo " Cluster bootstrap complete: k3s + nginx-ingress + cert-manager are ready."
echo " Next step, deploy the app:"
echo "   kubectl apply -f k8s/namespace.yaml"
echo "   kubectl apply -R -f k8s/"
echo "==================================================="