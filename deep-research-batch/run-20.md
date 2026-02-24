# Run 20
> **ID:** `resp_0ac8b1719806ef2d00699d70a2bca08194bbac373cda53bd2c`

## Token Usage
- Input: 25,654
- Output: 3,719
- Reasoning: 2,660
- Total: 29,373

## Search Calls

### Search 1: `e2b.dev sandbox for AI agents code execution what is it`
  - e2b.dev sandbox for AI agents code execution what is it
  - alternatives to E2B sandbox untrusted code execution for AI agents
  - Modal secure code execution sandbox run untrusted code
  - Firecracker microVM sandbox run untrusted code service

### Search 2: `"code execution" sandbox API "Firecracker" for AI agents`
  - "code execution" sandbox API "Firecracker" for AI agents
  - "sandbox" "AI agents" "microVM" API
  - Cloudflare Workers isolate security model V8 isolates
  - AWS Lambda Firecracker microVM technology

### Search 3: `Daytona.io sandbox provisioning AI workflows product`
  - Daytona.io sandbox provisioning AI workflows product
  - Vercel Sandbox Firecracker beta documentation
  - Northflank isolation Firecracker gVisor kata containers documentation
  - Modal Sandboxes product documentation

### Search 4: `Northflank isolation Firecracker gVisor Kata Containers documentation`
  - Northflank isolation Firecracker gVisor Kata Containers documentation
  - Northflank bring your own cloud deploy to your AWS GCP Azure docs
  - gVisor documentation container sandboxing
  - Kata Containers documentation hardware virtualization for containers

### Search 5: `Judge0 open source online code execution system Docker sandbox`
  - Judge0 open source online code execution system Docker sandbox
  - nsjail Google sandbox for untrusted code GitHub
  - firejail Linux namespaces seccomp sandbox
  - bubblewrap sandboxing tool flatpak

## Sites Referenced

- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox/?utm_source=openai)
- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Daytona | Secure AI Code Execution Platform](https://daytonadocs.com/?utm_source=openai)
- [Hopx - Secure Sandboxes for AI Agents | Run Untrusted Code Safely](https://hopx.ai/use-cases/execute-untrusted-code/?utm_source=openai)
- [Agent Sandbox - Secure Code Execution API for AI Agents](https://www.agentsandbox.co/?utm_source=openai)
- [Security model · Cloudflare Workers docs](https://developers.cloudflare.com/workers/reference/security-model/?utm_source=openai)
- [What is gVisor? - gVisor](https://gvisor.dev/docs/?utm_source=openai)
- [Container Virtualization - Open Source VM Software - Kata Containers | Kata Containers](https://katacontainers.org/software/?utm_source=openai)
- [Announcing the Firecracker Open Source Technology: Secure and Fast microVM for Serverless Computing | AWS Open Source Blog](https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/?utm_source=openai)
- [GitHub - restyler/awesome-sandbox: Awesome Code Sandboxing for AI](https://github.com/restyler/awesome-sandbox?utm_source=openai)
- [run dat sheesh | Firecracker Sandbox MicroVMs](https://rundatsheesh.dev/?utm_source=openai)

## Products Mentioned

AWS Lambda, Cloudflare, Daytona, Docker, E2B, Firecracker, Kata Containers, Modal, Spin, Vercel Sandbox, gVisor, nsjail

## Final Report

### Managed “sandbox API” alternatives (closest to E2B for running untrusted/LLM code)

- **Vercel Sandbox** — Ephemeral sandboxes specifically for “untrusted or user-generated code”, running in **Firecracker microVMs**; SDK/CLI; supports Node & Python runtimes (per docs). ([vercel.com](https://vercel.com/docs/vercel-sandbox/?utm_source=openai))  
- **Modal Sandboxes / Restricted Functions** — Modal’s primitives for executing **untrusted user/agent code**; you can run arbitrary commands in a sandbox, with configurable timeouts (up to 24h). ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
- **Daytona** — Marketed as a secure, fast, stateful execution platform “built specifically for AI-generated code and agent workflows.” ([daytonadocs.com](https://daytonadocs.com/?utm_source=openai))  
- **Hopx** — “Run untrusted code safely” using **Firecracker microVMs**, with resource limits and optional network isolation controls (per their site). ([hopx.ai](https://hopx.ai/use-cases/execute-untrusted-code/?utm_source=openai))  
- **AgentSandbox** — API positioned as a “trusted runtime for untrusted code” (Python/shell + artifacts/sessions). ([agentsandbox.co](https://www.agentsandbox.co/?utm_source=openai))  

### Edge / isolate-based (great for *short* tests; language limits)
- **Cloudflare Workers** — Runs code in **V8 isolates**; strong sandboxing model, but primarily **JS/WASM** and not a general Linux VM. Useful if your “testing” can be expressed as JS/WASM checks or controlled plugin execution. ([developers.cloudflare.com](https://developers.cloudflare.com/workers/reference/security-model/?utm_source=openai))  

### DIY / self-host options (more control; you assemble the platform)

If you’re building your own “run untrusted code” service, these are common building blocks:

- **gVisor (runsc)** — OCI runtime focused on stronger container isolation (good middle ground between Docker and full VMs). ([gvisor.dev](https://gvisor.dev/docs/?utm_source=openai))  
- **Kata Containers** — “VM-like” isolation for containers (packs kernels + hypervisors like QEMU/Cloud Hypervisor/Firecracker). ([katacontainers.org](https://katacontainers.org/software/?utm_source=openai))  
- **Firecracker** — microVM tech (also used by AWS Lambda). Great isolation; you’ll need to build orchestration, images, networking, limits, etc. ([aws.amazon.com](https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/?utm_source=openai))  
- **nsjail / minijail / bubblewrap** — Linux namespace + seccomp based process sandboxes (lighter weight; generally weaker boundary than microVMs if you’re truly adversarial/multi-tenant). ([github.com](https://github.com/restyler/awesome-sandbox?utm_source=openai))  
- **“run dat sheesh”** — An (alpha) self-hosted API layer around Firecracker-style microVM execution aimed at untrusted/LLM code. ([rundatsheesh.dev](https://rundatsheesh.dev/?utm_source=openai))  

---

## How to choose quickly
- **You want “E2B-but-not-E2B” for AI agents (Linux, install deps, run tests, capture artifacts):** Vercel Sandbox, Modal Sandboxes, Daytona. ([vercel.com](https://vercel.com/docs/vercel-sandbox/?utm_source=openai))  
- **You need the strongest isolation boundary for truly untrusted multi-tenant code:** prefer **microVM-based** offerings (Vercel/Daytona/Hopx/E2B) or DIY Firecracker/Kata. ([vercel.com](https://vercel.com/docs/vercel-sandbox/?utm_source=openai))  
- **You just need lightweight “safe-ish” execution with container tooling:** gVisor (and/or nsjail) in your infra. ([gvisor.dev](https://gvisor.dev/docs/?utm_source=openai))  
- **Your tests can be JS/WASM and you want ultra-fast spin-up at the edge:** Cloudflare Workers. ([developers.cloudflare.com](https://developers.cloudflare.com/workers/reference/security-model/?utm_source=openai))  

## 3 questions (so I can narrow to 2–3 best picks)
1) What languages/runtimes must you execute (Python? Node? arbitrary Linux binaries?)  
2) Do you need **network egress** during tests (pip/npm downloads, hitting APIs), or must it be air-gapped?  
3) Is this **multi-tenant/untrusted-user** code, or only code produced by *your* agent (lower adversarial risk)?