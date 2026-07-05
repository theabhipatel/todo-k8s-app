# k3s cluster bootstrap on a fresh EC2 (Ubuntu)

Quick reference for spinning up a new k3s node with ingress + SSL ready, from scratch.

## Prerequisites
- EC2 instance running Ubuntu 22.04 LTS or 24.04 LTS
- Security group: 22 (SSH, my IP), 80 (HTTP, anywhere), 443 (HTTPS, anywhere)
- Elastic IP allocated and associated
- SSH'd into the instance as `ubuntu`
- Your `k8s/` folder (including `cluster-issuer.yaml`) available on the server, e.g. via `git clone`

## Fast path: run the script

Instead of the manual steps below, just run:

```bash
chmod +x scripts/setup-cluster.sh
./scripts/setup-cluster.sh
```

This installs k3s (Traefik disabled), sets up kubectl, installs Helm, installs nginx-ingress, installs cert-manager, and applies your `ClusterIssuer` — fully automated, one command. After it finishes, deploy the app with:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/
```

---

## Manual steps (what the script above does, broken down)

### 1. Update the system
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install k3s (Traefik disabled — using nginx-ingress instead)
```bash
curl -sfL https://get.k3s.io | sh -s - --disable traefik
```

### 3. Verify k3s service is running
```bash
sudo systemctl status k3s
```
Look for `active (running)`. Press `q` to exit.

### 4. Check node status
```bash
sudo kubectl get nodes
```
Should show one node with status `Ready`.

### 5. Enable kubectl without sudo
```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
```

### 6. Confirm
```bash
kubectl get nodes
```
Should work without `sudo` now.

### 7. Install Helm
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 8. Install nginx-ingress controller
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace
```
Confirm: `kubectl get pods -n ingress-nginx` (wait for `Running`, `1/1`).

### 9. Install cert-manager
```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```
Confirm: `kubectl get pods -n cert-manager` (all 3 pods `Running`).

### 10. Apply the ClusterIssuer
```bash
kubectl apply -f k8s/cluster-issuer.yaml
```

---

## After bootstrap: deploy the app
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/
```

Check certificate issuance:
```bash
kubectl get certificate -n todo-app
```
Wait for `READY: True`. If stuck, debug with:
```bash
kubectl describe certificate todo-tls-secret -n todo-app
```

## Notes
- `--disable traefik` is only needed if you plan to install nginx-ingress or another ingress controller instead of k3s's default.
- DNS A records for your domains must already point at this server's Elastic IP before applying the ClusterIssuer/Ingress — cert-manager's HTTP-01 challenge needs to reach this server over port 80 to prove domain ownership.
- To add worker nodes later: run `sudo cat /var/lib/rancher/k3s/server/node-token` on this control-plane node, then on the new node run:
  ```bash
  curl -sfL https://get.k3s.io | K3S_URL=https://<control-plane-ip>:6443 K3S_TOKEN=<token> sh -
  ```