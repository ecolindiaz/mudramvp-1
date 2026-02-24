# Run 19
> **ID:** `resp_051f691f31e5234b00699d70a2491881978a7283bc2aedb82a`

## Token Usage
- Input: 39,985
- Output: 3,749
- Reasoning: 2,806
- Total: 43,734

## Search Calls

### Search 1: `e2b.dev sandbox for AI agents secure code execution alternatives`
  - e2b.dev sandbox for AI agents secure code execution alternatives
  - E2B code execution sandbox API
  - Judge0 API secure code execution sandbox
  - Piston code execution API sandbox

### Search 2: `Google Cloud Run uses gVisor sandboxing`
  - Google Cloud Run uses gVisor sandboxing
  - AWS Lambda Firecracker microVM technology
  - Kata Containers lightweight virtual machines for container workloads
  - gVisor user-space kernel sandbox for containers

### Search 3: `Judge0 code execution API Docker sandbox open source`
  - Judge0 code execution API Docker sandbox open source
  - Piston code execution engine API sandbox open source
  - nsjail sandboxing tool for untrusted code
  - Firecracker microvm open source virtualization for serverless

### Search 4: `Modal isolation gVisor security`
  - Modal isolation gVisor security
  - Daytona dev sandbox API secure code execution
  - Vercel Sandbox Firecracker beta
  - Northflank microVM Kata Containers gVisor sandbox

### Search 5: `Modal uses gVisor isolation`
  - Modal uses gVisor isolation
  - Modal security isolation gVisor container runtime
  - Modal documentation security sandbox
  - Judge0 code execution system API open source GitHub

### Search 6: `AWS Lambda Firecracker microVMs runs each function in a Firecracker microVM`
  - AWS Lambda Firecracker microVMs runs each function in a Firecracker microVM
  - Firecracker lightweight virtualization for serverless computing Jeff Barr 2018
  - AWS Fargate Firecracker microVMs
  - AWS Lambda execution environment Firecracker

## Sites Referenced

- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox/?utm_source=openai)
- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Daytona | Secure AI Code Execution Platform](https://daytonadocs.com/?utm_source=openai)
- [Secure sandboxes for multi-tenant workloads — Northflank](https://northflank.com/product/sandboxes?utm_source=openai)
- [YepCode Run - Execution Sandbox environment for AI-generated code](https://yepcode.io/run/?utm_source=openai)
- [How AgentCore Tools session isolation works - Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/built-in-tools-how-it-works.html?utm_source=openai)
- [GitHub - judge0/judge0: Robust, fast, scalable, and sandboxed open-source online code execution system for humans and AI.](https://github.com/judge0/judge0?utm_source=openai)
- [GitHub - engineer-man/piston: A high performance general purpose code execution engine.](https://github.com/engineer-man/piston?utm_source=openai)
- [GitHub - firecracker-microvm/firecracker: Secure and fast microVMs for serverless computing.](https://github.com/firecracker-microvm/firecracker?utm_source=openai)
- [Kata Containers - Open Source Container Runtime Software | Kata Containers](https://katacontainers.org/?utm_source=openai)
- [What is gVisor? - gVisor](https://gvisor.dev/docs/?utm_source=openai)
- [Container runtime contract  |  Cloud Run  |  Google Cloud Documentation](https://docs.cloud.google.com/run/docs/container-contract?utm_source=openai)
- [OpenCode sandbox | Docker Docs](https://docs.docker.com/ai/sandboxes/agents/opencode/?utm_source=openai)
- [Networking and security | Modal Docs](https://frontend.modal.com/docs/guide/sandbox-networking?utm_source=openai)

## Products Mentioned

Daytona, Docker, E2B, Firecracker, GKE Sandbox, Google Cloud Run, Judge0, Kata Containers, Modal, Northflank, Piston, Vercel Sandbox, gVisor

## Final Report

## Hosted “sandbox-as-an-API” (closest to E2B)
- **Vercel Sandbox** — ephemeral environments designed to run untrusted / AI-generated code, with **Firecracker microVM** isolation and SDK/CLI workflows. ([vercel.com](https://vercel.com/docs/vercel-sandbox/?utm_source=openai))  
- **Modal Sandboxes** — run untrusted user/agent code inside **secure containers**, with explicit outbound network controls (block all egress or CIDR allowlist) and a model that isolates sandboxes from your Modal workspace by default. ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
- **Daytona** — positioned specifically for fast, secure, stateful execution of AI-generated code and agent workflows (SDK-driven). ([daytonadocs.com](https://daytonadocs.com/?utm_source=openai))  
- **Northflank Sandboxes** — production-oriented sandboxes for multi-tenant workloads with options like **Kata Containers / gVisor** and “run in their cloud or your VPC” (BYOC). ([northflank.com](https://northflank.com/product/sandboxes?utm_source=openai))  
- **YepCode Run** — serverless runtime/SDK marketed for executing AI-generated code in secure sandboxes. ([yepcode.io](https://yepcode.io/run/?utm_source=openai))  
- **Amazon Bedrock AgentCore Tools (Code Interpreter / Browser)** — managed tool sessions with **one-session-one-Firecracker-microVM** isolation (useful if you want “code interpreter” capability more than “generic Linux box”). ([docs.aws.amazon.com](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/built-in-tools-how-it-works.html?utm_source=openai))  

## Self-hostable code-execution platforms (you operate the sandbox)
- **Judge0 (OSS + SaaS)** — “sandboxed online code execution system” with an HTTP API; common choice when you want a battle-tested multi-language runner you can run yourself. ([github.com](https://github.com/judge0/judge0?utm_source=openai))  
- **Piston (OSS)** — executes code inside an “Isolate” sandbox with resource limiting and (by default) no outbound networking. ([github.com](https://github.com/engineer-man/piston?utm_source=openai))  

## Build-your-own isolation (lower-level primitives)
- **Firecracker** — run each execution in a microVM; strong isolation boundary for untrusted workloads. ([github.com](https://github.com/firecracker-microvm/firecracker?utm_source=openai))  
- **Kata Containers** — “security of VMs” with container workflows; can use multiple hypervisors including Firecracker. ([katacontainers.org](https://katacontainers.org/?utm_source=openai))  
- **gVisor** — user-space “application kernel” sandbox for containers (good defense-in-depth vs plain Docker). ([gvisor.dev](https://gvisor.dev/docs/?utm_source=openai))  
- **Google Cloud Run (1st gen) / GKE Sandbox** — if you’re already on GCP, these give a gVisor-based sandbox option for running containers that execute untrusted code. ([docs.cloud.google.com](https://docs.cloud.google.com/run/docs/container-contract?utm_source=openai))  
- **Docker Desktop “Docker Sandboxes” (local dev)** — useful for testing agent execution locally in an isolated sandbox workflow (still not the same threat model as multi-tenant cloud). ([docs.docker.com](https://docs.docker.com/ai/sandboxes/agents/opencode/?utm_source=openai))  

## Quick way to choose
- Want **microVM isolation** like E2B: **Vercel Sandbox**, **Northflank**, or roll your own with **Firecracker/Kata**. ([vercel.com](https://vercel.com/docs/vercel-sandbox/?utm_source=openai))  
- Want **fast iteration + strong egress control** (block/allowlist): **Modal Sandboxes**. ([frontend.modal.com](https://frontend.modal.com/docs/guide/sandbox-networking?utm_source=openai))  
- Want **self-host + lots of languages**: **Judge0** or **Piston**. ([github.com](https://github.com/judge0/judge0?utm_source=openai))  

If you tell me (1) languages you need, (2) whether you need **internet access** from the sandbox, and (3) hosted vs self-hosted, I can narrow this to 2–3 best-fit options with the security knobs to enable (timeouts, egress policy, filesystem persistence, secrets strategy).