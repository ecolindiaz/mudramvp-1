# Run 13
> **ID:** `resp_0e79d70f3fc0202900699d709fd82c81948b33018fc0d58da4`

## Token Usage
- Input: 39,526
- Output: 3,703
- Reasoning: 2,722
- Total: 43,229

## Search Calls

### Search 1: `e2b.dev sandboxed code execution API alternatives`
  - e2b.dev sandboxed code execution API alternatives
  - E2B sandbox alternative "code interpreter" infrastructure
  - Modal secure code execution sandbox API
  - Daytona platform secure development environment alternative e2b

### Search 2: `Vercel Sandbox Firecracker session limit 45 minutes`
  - Vercel Sandbox Firecracker session limit 45 minutes
  - Daytona.io AI sandboxes provisioning 90ms
  - Northflank kata containers gVisor secure code execution sandbox
  - Cloudflare Workers isolates security model run untrusted code

### Search 3: `Modal Sandboxes gVisor isolation`
  - Modal Sandboxes gVisor isolation
  - Google Cloud Run gVisor sandboxing
  - AWS Lambda Firecracker microVM
  - Google gVisor runsc container runtime security

### Search 4: `AWS Lambda Firecracker microVMs announcement 2018`
  - AWS Lambda Firecracker microVMs announcement 2018
  - AWS Firecracker lightweight virtualization for serverless Lambda Fargate
  - AWS blog Firecracker virtualization technology for AWS Lambda
  - AWS Fargate Firecracker isolation

### Search 5: `Modal Sandboxes gVisor`
  - Modal Sandboxes gVisor
  - Modal security isolation gVisor
  - Modal sandbox isolation technology
  - site:modal.com gVisor

### Search 6: `Fly.io Machines API microVM less than a second`
  - Fly.io Machines API microVM less than a second
  - Fly Machines are Firecracker microVMs
  - fly.io machines documentation microvm firecracker
  - site:fly.io machines firecracker

## Sites Referenced

- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Networking and security | Modal Docs](https://frontend.modal.com/docs/guide/sandbox-networking?utm_source=openai)
- [Vercel Sandbox pricing and limits](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai)
- [Cloudflare Sandboxes - Secure Code Execution](https://workers.cloudflare.com/product/sandboxes?utm_source=openai)
- [Secure sandboxes for multi-tenant workloads — Northflank](https://northflank.com/product/sandboxes?utm_source=openai)
- [Daytona - Secure Infrastructure for Running AI-Generated Code](https://www.daytona.io/?utm_source=openai)
- [Fly Machines · Fly](https://fly.io/machines?utm_source=openai)
- [Docker Quick Start - gVisor](https://gvisor.dev/docs/user_guide/quick_start/docker/?utm_source=openai)
- [GKE Sandbox  |  GKE security  |  Google Cloud Documentation](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai)
- [GitHub - restyler/awesome-sandbox: Awesome Code Sandboxing for AI](https://github.com/restyler/awesome-sandbox?utm_source=openai)
- [Announcing the Firecracker Open Source Technology: Secure and Fast microVM for Serverless Computing | AWS Open Source Blog](https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/?utm_source=openai)
- [Run User Code on Fly Machines · Fly Docs](https://fly.io/docs/machines/guides-examples/functions-with-machines/?utm_source=openai)

## Products Mentioned

AWS Lambda, Cloudflare, Daytona, Docker, E2B, Firecracker, Fly.io, GKE Sandbox, Modal, Northflank, Spin, Vercel Sandbox, gVisor, nsjail

## Final Report

Here are solid **E2B.dev alternatives** specifically for **securely running/testing AI‑generated (untrusted) code**. I’m grouping them by “hosted sandbox API” vs “DIY/self-host”, since that’s usually the deciding factor.

## Hosted “sandbox execution” APIs (closest to E2B)

1) **Modal Sandboxes**
- Purpose-built for **executing untrusted / LLM-generated code** in isolated sandboxes. ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
- Useful security knobs: **no inbound by default**, can **block all egress** or use **CIDR allowlists**. ([frontend.modal.com](https://frontend.modal.com/docs/guide/sandbox-networking?utm_source=openai))

2) **Vercel Sandbox**
- Managed sandbox runtime with clear runtime limits: **Hobby up to 45 minutes**, **Pro/Enterprise up to 5 hours**. ([vercel.com](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai))  
- If your workflow is already Vercel-centric (preview envs, web apps), it’s convenient.

3) **Cloudflare Sandboxes (Workers/Containers)**
- Marketed explicitly for “**run untrusted code**” for AI agents/code interpreters; supports **filesystem + package install + bring your own container images**. ([workers.cloudflare.com](https://workers.cloudflare.com/product/sandboxes?utm_source=openai))  
- Good fit when you want global placement and fast spin-up.

4) **Northflank Sandboxes**
- Focus on **microVM isolation** for multi-tenant/untrusted workloads; can run in **their cloud or inside your VPC**. ([northflank.com](https://northflank.com/product/sandboxes?utm_source=openai))  
- More “platform” than “SDK toy sandbox”, useful when you’re moving toward production/multi-tenant.

5) **Daytona**
- Infrastructure geared toward AI agents; claims **sub‑90ms sandbox creation** and supports volumes/shared data across sandboxes. ([daytona.io](https://www.daytona.io/?utm_source=openai))

6) **Fly.io Machines (DIY-ish but hosted)**
- Firecracker microVMs (“same … microVMs that back AWS Lambda”) and they explicitly call out the “run user code safely” use case; Machines can boot around ~300ms. ([fly.io](https://fly.io/machines?utm_source=openai))  
- You’ll build more of the sandbox controls yourself (network policy, snapshots, etc.).

## DIY / self-host building blocks (when you need max control)

- **gVisor (`runsc`)**: run containers with a stronger sandbox boundary than vanilla containers; works with Docker/K8s. ([gvisor.dev](https://gvisor.dev/docs/user_guide/quick_start/docker/?utm_source=openai))  
- **GKE Sandbox**: Google’s managed way to run pods with **gVisor RuntimeClass** for “unknown or untrusted code”. ([docs.cloud.google.com](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/sandbox-pods?utm_source=openai))  
- **nsjail**: lightweight process sandboxing using namespaces + seccomp + cgroups (good for simple “run a command” runners). ([github.com](https://github.com/restyler/awesome-sandbox?utm_source=openai))  
- **Firecracker** (if you want E2B-like microVM isolation self-managed): AWS describes it as the foundation for Lambda sandboxes. ([aws.amazon.com](https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/?utm_source=openai))

## Quick pick guide
- **Need the closest thing to E2B (agent-friendly SDK + secure execution):** Modal, Cloudflare Sandboxes, Daytona.
- **Need longer-running sessions / enterprise isolation / VPC control:** Northflank, or DIY with K8s + gVisor/Kata/Firecracker.
- **Need microVMs with a simple API and are OK assembling the rest:** Fly Machines. ([fly.io](https://fly.io/docs/machines/guides-examples/functions-with-machines/?utm_source=openai))

## 3 questions so I can narrow this to 2–3 best fits
1) What languages/runtimes do you need to execute (Python only, Node, arbitrary binaries, Docker images)?
2) Does untrusted code need **internet egress**, and if yes, do you need an **allowlist** (e.g., only npm/pypi/github)?
3) Hosted-only OK, or do you need **BYOC/self-host** (for compliance / data locality)?

If you answer those, I’ll recommend a concrete stack and a “secure default” policy (timeouts, CPU/mem, egress rules, secrets handling) for running AI-generated code safely.