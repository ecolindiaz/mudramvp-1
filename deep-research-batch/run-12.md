# Run 12
> **ID:** `resp_0c2891f284205e9300699d709f7aa88195b9e56f7d0e5b1896`

## Token Usage
- Input: 40,304
- Output: 3,896
- Reasoning: 2,914
- Total: 44,200

## Search Calls

### Search 1: `e2b.dev sandbox alternatives secure code execution for LLM agents`
  - e2b.dev sandbox alternatives secure code execution for LLM agents
  - cloud sandbox code execution api alternatives to e2b
  - open-source code sandbox execution tool firecracker gvisor agent testing
  - remote code execution sandbox service API 'run code' 'sandbox' for LLM

### Search 2: `Modal sandbox gVisor isolation documentation`
  - Modal sandbox gVisor isolation documentation
  - Vercel Sandbox beta Firecracker documentation 45 minute limit
  - Cloudflare Workers V8 isolates security model documentation
  - Kata Containers lightweight VM for container isolation documentation

### Search 3: `Daytona.io sandbox for AI agents provisioning sub-90ms`
  - Daytona.io sandbox for AI agents provisioning sub-90ms
  - Northflank microvm sandboxes for AI agents firecracker
  - Modal security gVisor isolates documentation
  - nsjail secure sandbox linux tool github

### Search 4: `Modal security isolation gVisor documentation modal.com gVisor`
  - Modal security isolation gVisor documentation modal.com gVisor
  - Modal uses gVisor for sandboxing
  - Daytona sandbox SDK AI-generated code execute in isolated environments documentation
  - Microsandbox libkrun microvm sandbox tool

### Search 5: `Modal gVisor runsc isolation`
  - Modal gVisor runsc isolation
  - site:modal.com gVisor runsc
  - site:modal.com docs security isolation
  - Modal containers are run inside gVisor

### Search 6: `site:vercel.com "Vercel Sandbox" Firecracker`
  - site:vercel.com "Vercel Sandbox" Firecracker
  - Vercel Sandbox isolation microvm Firecracker
  - Vercel Sandbox architecture microVM
  - Vercel Sandbox Python Node.js runtimes beta

## Sites Referenced

- [Sandbox SDK Reference](https://vercel.com/docs/vercel-sandbox/sdk-reference?utm_source=openai)
- [Run untrusted code with Restricted Functions | Modal Docs](https://modal.com/docs/guide/restricted-access?utm_source=openai)
- [Agent Engine Code Execution  |  Vertex AI Agent Builder  |  Google Cloud](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/code-execution/overview?utm_source=openai)
- [Security model · Cloudflare Workers docs](https://developers.cloudflare.com/workers/reference/security-model/?utm_source=openai)
- [Secure runtime for codegen tools: microVMs, sandboxing, and execution at scale | Blog — Northflank](https://northflank.com/blog/secure-runtime-for-codegen-tools-microvms-sandboxing-and-execution-at-scale?utm_source=openai)
- [Documentation · Daytona](https://www.daytona.io/docs/?utm_source=openai)
- [GitHub - zerocore-ai/microsandbox: self-hosted plaform for secure execution of untrusted user or AI-generated code](https://github.com/zerocore-ai/microsandbox?utm_source=openai)
- [Kata Containers - Open Source Container Runtime Software | Kata Containers](https://katacontainers.org/?utm_source=openai)
- [What is gVisor? - gVisor](https://gvisor.dev/docs/?utm_source=openai)
- [GitHub - restyler/awesome-sandbox: Awesome Code Sandboxing for AI](https://github.com/restyler/awesome-sandbox?utm_source=openai)
- [GitHub - vndee/llm-sandbox: Lightweight and portable LLM sandbox runtime (code interpreter) Python library.](https://github.com/vndee/llm-sandbox?utm_source=openai)
- [Matchlock: Secure AI Agent Sandboxing with MicroVMs - Akmatori Blog](https://akmatori.com/blog/matchlock-ai-sandbox?utm_source=openai)

## Products Mentioned

Cloudflare, Daytona, Docker, E2B, Firecracker, Kata Containers, Modal, Northflank, Podman, Vercel Sandbox, gVisor, nsjail

## Final Report

Good E2B alternatives fall into two buckets: **managed sandboxes (API, no infra)** and **self-hosted isolation (more control / compliance)**. Which one fits depends on whether you need a **full Linux VM**, which **languages**, and whether you must **self-host**.

## Managed “run untrusted code” sandboxes (closest to E2B)
- **Vercel Sandbox** — Ephemeral **Linux microVMs (Firecracker)** you can create on-demand to run untrusted code / agent output. Node.js + Python runtimes, snapshots, ports, etc. ([vercel.com](https://vercel.com/docs/vercel-sandbox/sdk-reference?utm_source=openai))  
- **Modal (Sandboxes + Restricted Functions)** — Runs containers with **gVisor** for stronger isolation than plain containers; has explicit features for running untrusted code like **blocking network** and **single-use containers**. ([modal.com](https://modal.com/docs/guide/restricted-access?utm_source=openai))  
- **Google Vertex AI Agent Engine – Code Execution** — Managed, isolated sandbox designed for agents; state can persist (TTL) up to **14 days**. ([cloud.google.com](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/code-execution/overview?utm_source=openai))  
- **Cloudflare Workers / workerd** — Not a “full Linux box”, but very strong sandboxing via **V8 isolates** and a constrained API surface; great for “test untrusted JS/TS (and some Python/Rust in Workers)” style execution. ([developers.cloudflare.com](https://developers.cloudflare.com/workers/reference/security-model/?utm_source=openai))  
- **Northflank Sandboxes / microVM platform (BYOC option)** — If you want “E2B-like” execution but with the option to run in *your* cloud/VPC, they position around **Kata Containers / microVM isolation** at scale. ([northflank.com](https://northflank.com/blog/secure-runtime-for-codegen-tools-microvms-sandboxing-and-execution-at-scale?utm_source=openai))  

## Self-hosted / open-source (when you need maximum control)
- **Daytona (open-source)** — SDK-managed “sandboxes” for running AI-generated code, with stateful environments and a hosted option. ([daytona.io](https://www.daytona.io/docs/?utm_source=openai))  
- **Microsandbox** — Self-hosted platform focused on executing untrusted user/AI code using **microVM isolation via libkrun**, with SDKs. ([github.com](https://github.com/zerocore-ai/microsandbox?utm_source=openai))  
- **Kata Containers** — Run “containers that are actually lightweight VMs” (stronger isolation, Kubernetes-friendly). ([katacontainers.org](https://katacontainers.org/?utm_source=openai))  
- **gVisor (`runsc`)** — A practical middle-ground: stronger than standard containers; integrates with Docker/Kubernetes. ([gvisor.dev](https://gvisor.dev/docs/?utm_source=openai))  
- **nsjail / minijail (process sandboxing)** — If you’re building your own runner: Linux namespaces + seccomp-based isolation and tight resource limits. ([github.com](https://github.com/restyler/awesome-sandbox?utm_source=openai))  
- **LLM-focused runner glue**
  - **`llm-sandbox`** (library + MCP server) to execute code in isolated backends like Docker/Podman/K8s. ([github.com](https://github.com/vndee/llm-sandbox?utm_source=openai))  

## If your main concern is “don’t leak secrets”
Two patterns to consider:
- **Hard egress controls** (default-deny networking; allowlist only what you need).
- **Keep secrets out of the sandbox entirely**. Example: **Matchlock** describes intercepting outbound requests and injecting credentials on the host side so the VM never sees real keys. ([akmatori.com](https://akmatori.com/blog/matchlock-ai-sandbox?utm_source=openai))  

## 3 quick questions so I can narrow to the best 2–3 options
1) Do you need a **full Linux environment** (apt/dnf, arbitrary binaries), or just **JS/Python code snippets**?  
2) Must it be **self-hosted / in your VPC** (SOC2/HIPAA/compliance), or is SaaS fine?  
3) Should sandboxes have **internet access** (package installs, API calls), or be **network-blocked by default**?