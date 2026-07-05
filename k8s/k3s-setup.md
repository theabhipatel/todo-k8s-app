# k3s setup on a fresh EC2 (Ubuntu)

Quick reference for spinning up a new k3s control-plane node.

## Prerequisites
- EC2 instance running Ubuntu 22.04 LTS or 24.04 LTS
- Security group: 22 (SSH, my IP), 80 (HTTP, anywhere), 443 (HTTPS, anywhere)
- Elastic IP allocated and associated
- SSH'd into the instance as `ubuntu`

## 1. Update the system
```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Install k3s (Traefik disabled — using nginx-ingress instead)
```bash
curl -sfL https://get.k3s.io | sh -s - --disable traefik
```

## 3. Verify k3s service is running
```bash
sudo systemctl status k3s
```
Look for `active (running)`. Press `q` to exit.

## 4. Check node status
```bash
sudo kubectl get nodes
```
Should show one node with status `Ready`.

## 5. Enable kubectl without sudo
```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
```

## 6. Confirm
```bash
kubectl get nodes
```
Should work without `sudo` now.

## Notes
- `--disable traefik` is only needed if you plan to install nginx-ingress or another ingress controller instead of k3s's default.
- To add worker nodes later: run `sudo cat /var/lib/rancher/k3s/server/node-token` on this control-plane node, then on the new node run:
  ```bash
  curl -sfL https://get.k3s.io | K3S_URL=https://<control-plane-ip>:6443 K3S_TOKEN=<token> sh -
  ```