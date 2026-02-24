# Run 14
> **ID:** `resp_0fe21e6a55e56c6f00699d70a044a8819782a56356991f25fb`

## Token Usage
- Input: 29,394
- Output: 3,262
- Reasoning: 2,367
- Total: 32,656

## Search Calls

### Search 1: `e2b.dev open source secure code execution sandbox for AI agents`
  - e2b.dev open source secure code execution sandbox for AI agents
  - alternatives to E2B code interpreter sandbox service
  - Firecracker microvm sandboxed code execution service for untrusted code
  - gVisor Kata Containers sandboxed container runtime untrusted code

### Search 2: `Modal Sandboxes documentation gVisor sandbox`
  - Modal Sandboxes documentation gVisor sandbox
  - Vercel Sandbox Firecracker session limit 45 minutes
  - Daytona sandbox ai workflows sub-90ms provisioning
  - Cloudflare Workers isolates V8 secure sandbox

### Search 3: `AWS Lambda uses Firecracker microVMs to isolate workloads`
  - AWS Lambda uses Firecracker microVMs to isolate workloads
  - Firecracker microVM open source project security isolation for serverless
  - Kata Containers is a container runtime using lightweight VMs for isolation
  - gVisor userspace kernel sandbox for containers untrusted code

### Search 4: `Daytona sandbox product secure code execution for AI agents`
  - Daytona sandbox product secure code execution for AI agents
  - daytona.io agent sandbox API start container in milliseconds
  - Northflank bring your own container OCI run untrusted code sandbox
  - Fly.io Machines lightweight VMs run Docker image

## Sites Referenced

- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Vercel Sandbox pricing and limits](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai)
- [Cloudflare Sandboxes - Secure Code Execution](https://workers.cloudflare.com/product/sandboxes?utm_source=openai)
- [Daytona | Secure AI Code Execution Platform](https://daytonadocs.com/?utm_source=openai)
- [Fly Machines · Fly](https://fly.io/machines?utm_source=openai)
- [GitHub - firecracker-microvm/firecracker: Secure and fast microVMs for serverless computing.](https://github.com/firecracker-microvm/firecracker?utm_source=openai)
- [Ravon Sandbox - Open Source MicroVM Code Execution Platform](https://ravon.cloud/?utm_source=openai)
- [Kata Containers - Open Source Container Runtime Software | Kata Containers](https://katacontainers.org/?utm_source=openai)
- [Introduction to gVisor security - gVisor](https://gvisor.dev/docs/architecture_guide/intro/?utm_source=openai)
- [smol machines](https://smolmachines.com/?utm_source=openai)

## Products Mentioned

AWS Lambda, Cloudflare, Daytona, E2B, Firecracker, Fly.io, GKE Sandbox, Kata Containers, Modal, Vercel Sandbox, gVisor, smolVM, smolmachines

## Final Report

If you mean **“run AI-generated code/tests somewhere isolated so it can’t harm prod or steal secrets”**, here are solid **E2B alternatives** (plus a couple self-host options).

## Managed “run untrusted code” sandboxes (closest to E2B)

- **Modal Sandboxes** — secure containers for executing untrusted/user/agent code; supports running arbitrary commands and configurable timeouts (up to 24h). ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
- **Vercel Sandbox** — managed sandboxes for **Node.js/Python** with explicit runtime/resource limits (Hobby up to 45 min; Pro/Enterprise up to 5 hours) and currently region-limited. ([vercel.com](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai))  
- **Cloudflare Sandboxes / Sandbox SDK (Beta)** — run untrusted code in isolated container environments controlled from Workers; positioned specifically for AI agents/code interpreters and supports “bring your own images.” ([workers.cloudflare.com](https://workers.cloudflare.com/product/sandboxes?utm_source=openai))  
- **Daytona** — positioned as a secure, fast, stateful execution platform for AI-generated code/agent workflows (their docs emphasize this focus). ([daytonadocs.com](https://daytonadocs.com/?utm_source=openai))  
- **Fly.io Machines** — lightweight VMs; good if you want to run your own “sandbox pool” service using container images, with Firecracker underneath. ([fly.io](https://fly.io/machines?utm_source=openai))  
- **AWS Lambda** — not AI-specific, but widely used for isolated execution; Firecracker was developed at AWS to accelerate services like Lambda/Fargate. ([github.com](https://github.com/firecracker-microvm/firecracker?utm_source=openai))  

## Self-host / build-your-own (when you need maximum control)

- **Ravon Sandbox (open-source)** — self-hostable code execution platform built on Firecracker microVMs. ([ravon.cloud](https://ravon.cloud/?utm_source=openai))  
- **Firecracker directly** — the underlying microVM tech (you orchestrate images, networking, quotas, cleanup, etc.). ([github.com](https://github.com/firecracker-microvm/firecracker?utm_source=openai))  
- **Kata Containers** — OCI-compatible runtime that runs containers inside lightweight VMs (can use Firecracker among other hypervisors). ([katacontainers.org](https://katacontainers.org/?utm_source=openai))  
- **gVisor / GKE Sandbox** — stronger-than-default container isolation via a userspace kernel approach; GKE Sandbox uses gVisor for untrusted code defense-in-depth. ([gvisor.dev](https://gvisor.dev/docs/architecture_guide/intro/?utm_source=openai))  
- **smolVM (local dev)** — local microVM packaging/running aimed at safely running workloads on your own machine. ([smolmachines.com](https://smolmachines.com/?utm_source=openai))  

## What to pick (fast heuristic)
- Want **best “drop-in” dev experience** for agent code execution: **E2B / Daytona / Modal / Cloudflare Sandboxes**
- Want **microVM isolation** but more control: **Fly Machines** or **self-host Ravon/Firecracker/Kata**
- Want **Kubernetes-native** isolation: **GKE Sandbox (gVisor)** or **Kata** on your cluster

## Don’t forget: “secure testing” usually needs more than a sandbox
Even with isolation, most teams add a pipeline like:
1) **Static checks** (lint + SAST like Semgrep/CodeQL)  
2) **Dependency vuln scan** (e.g., osv-scanner/Trivy)  
3) **Run unit/integration tests inside the sandbox** with **no secrets**, strict CPU/mem/time limits, and **egress allowlisting**  
4) Tear down + store logs/artifacts

If you tell me:
- languages (Python/Node/…),
- whether tests need internet access,
- and whether you need self-host/BYOC (VPC),
I can narrow this to 2–3 best-fit options and a reference architecture.