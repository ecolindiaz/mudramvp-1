# Run 17
> **ID:** `resp_051dcab2d6005e1f00699d70a15d5081939878987ca36a0f69`

## Token Usage
- Input: 55,289
- Output: 5,592
- Reasoning: 4,327
- Total: 60,881

## Search Calls

### Search 1: `e2b.dev secure sandbox code execution alternatives`
  - e2b.dev secure sandbox code execution alternatives
  - E2B code interpreter sandbox firecracker alternatives
  - nsjail untrusted code execution sandbox service
  - cloud sandbox API execute code in isolated environment microvm service

### Search 2: `Modal Sandbox documentation gVisor`
  - Modal Sandbox documentation gVisor
  - Vercel Sandbox Firecracker session limit 45 minutes beta
  - Daytona.io AI sandbox provisioning sub-90ms
  - Northflank Kata Containers gVisor sandbox isolation

### Search 3: `Fly.io Machines Firecracker microVMs`
  - Fly.io Machines Firecracker microVMs
  - AWS Lambda Firecracker microVM
  - Google Cloud Run gVisor sandboxed container runtime
  - nsjail github untrusted code execution sandbox

### Search 4: `Google nsjail GitHub untrusted code execution`
  - Google nsjail GitHub untrusted code execution
  - Windmill nsjail sandbox untrusted code docs
  - firecracker microvm open source VMM secure execution
  - Kata Containers microVM isolation run containers in lightweight VMs

### Search 5: `google nsjail GitHub repository`
  - google nsjail GitHub repository
  - nsjail documentation seccomp namespaces cgroups
  - Windmill nsjail disabled by default DISABLE_NSJAIL false

### Search 6: `Vercel Sandbox Firecracker`
  - Vercel Sandbox Firecracker
  - Vercel Sandbox uses Firecracker microVM
  - Vercel Sandbox architecture microvm
  - Modal sandboxes gVisor runtime

### Search 7: `Modal sandboxes gVisor isolation`
  - Modal sandboxes gVisor isolation
  - Modal uses gVisor runtime
  - Modal security gVisor
  - Modal sandbox isolation technology

### Search 8: `Cloudflare Workers V8 isolates secure sandboxed execution model`
  - Cloudflare Workers V8 isolates secure sandboxed execution model
  - Cloudflare Workers isolates no cold starts V8 isolate
  - Cloudflare Workers security model isolate per request
  - Deno Deploy isolates runtime

### Search 9: `site:e2b.dev Firecracker microVM`
  - site:e2b.dev Firecracker microVM
  - E2B uses Firecracker microVMs
  - E2B architecture Firecracker
  - E2B open source firecracker

## Sites Referenced

- [Understanding Sandboxes](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai)
- [Vercel Sandbox pricing and limits](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai)
- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Memory Snapshots: Checkpoint/Restore for Sub-second Startup](https://modal.com/blog/mem-snapshots?utm_source=openai)
- [Networking and security | Modal Docs](https://frontend.modal.com/docs/guide/sandbox-networking?utm_source=openai)
- [Cloudflare Sandboxes - Secure Code Execution](https://workers.cloudflare.com/product/sandboxes?utm_source=openai)
- [Architecture · Cloudflare Sandbox SDK docs](https://developers.cloudflare.com/sandbox/concepts/architecture/?utm_source=openai)
- [Daytona - Secure Infrastructure for Running AI-Generated Code](https://www.daytona.io/?utm_source=openai)
- [Secure sandboxes for multi-tenant workloads — Northflank](https://northflank.com/product/sandboxes?utm_source=openai)
- [Fly Machines · Fly](https://fly.io/machines?utm_source=openai)
- [GitHub - zerocore-ai/microsandbox: self-hosted plaform for secure execution of untrusted user or AI-generated code](https://github.com/zerocore-ai/microsandbox?utm_source=openai)
- [Agent Sandbox](https://agent-sandbox.sigs.k8s.io/?utm_source=openai)
- [GitHub - firecracker-microvm/firecracker: Secure and fast microVMs for serverless computing.](https://github.com/firecracker-microvm/firecracker?utm_source=openai)
- [Kata Containers - Open Source Container Runtime Software | Kata Containers](https://katacontainers.org/?utm_source=openai)
- [What is gVisor? - gVisor](https://gvisor.dev/docs/?utm_source=openai)
- [GitHub - google/nsjail: A lightweight process isolation tool that utilizes Linux namespaces, cgroups, rlimits and seccomp-bpf syscall filters, leveraging the Kafel BPF language for enhanced security.](https://github.com/google/nsjail?utm_source=openai)
- [GitHub - openedx/codejail: Secure code execution](https://github.com/openedx/codejail?utm_source=openai)

## Products Mentioned

Cloudflare, Daytona, E2B, Firecracker, Fly.io, Kata Containers, Modal, Northflank, Spin, Vercel Sandbox, gVisor, nsjail

## Final Report

## Closest “E2B-style” sandbox APIs (run untrusted / AI-generated code + tests)

1) **Vercel Sandboxes** — *microVM (Firecracker), strong isolation*  
   - On-demand isolated Linux environments for **running untrusted code / AI scripts / tests**. ([vercel.com](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai))  
   - Runs **in a dedicated Firecracker microVM (dedicated kernel)**. ([vercel.com](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai))  
   - **Node.js + Python**; runtime limits depend on plan (e.g., Hobby 45 min, Pro/Ent up to 5 hours). ([vercel.com](https://vercel.com/docs/vercel-sandbox/pricing/?utm_source=openai))  

2) **Modal Sandboxes** — *secure containers (gVisor), great for parallel test runs*  
   - Designed to **execute LLM-generated/untrusted code** in isolated sandboxes. ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
   - Modal states it uses **gVisor (`runsc`)** for isolation. ([modal.com](https://modal.com/blog/mem-snapshots?utm_source=openai))  
   - Has explicit **network restriction controls** (block all egress or CIDR allowlist). ([frontend.modal.com](https://frontend.modal.com/docs/guide/sandbox-networking?utm_source=openai))  

3) **Cloudflare Sandboxes (Sandbox SDK)** — *container-based sandboxes controlled from Workers*  
   - Positioned specifically for **AI agents / code interpreters**: execute code, install packages, filesystem I/O, run commands. ([workers.cloudflare.com](https://workers.cloudflare.com/product/sandboxes?utm_source=openai))  
   - Architecture: **Workers + Durable Objects + Containers** (the untrusted code runs in an isolated Linux container). ([developers.cloudflare.com](https://developers.cloudflare.com/sandbox/concepts/architecture/?utm_source=openai))  

4) **Daytona** — *very fast provisioned “sandboxes” for agent workflows*  
   - Markets **sub‑90ms sandbox creation** and “execute AI-generated code with zero risk to your infrastructure”. ([daytona.io](https://www.daytona.io/?utm_source=openai))  

5) **Northflank Sandboxes** — *microVM options + BYOC/VPC story*  
   - “Run untrusted code at scale with microVMs… **in our cloud or your VPC**.” ([northflank.com](https://northflank.com/product/sandboxes?utm_source=openai))  
   - Uses **Kata Containers or gVisor** depending on environment/isolation needs. ([northflank.com](https://northflank.com/product/sandboxes?utm_source=openai))  

6) **Fly.io Machines** — *microVM (Firecracker), good when you want more “VM control”*  
   - Machines are **fast-booting VMs** and explicitly **use Firecracker**. ([fly.io](https://fly.io/machines?utm_source=openai))  
   - Best when you want to run your own “test runner service” that spins per-PR/per-task machines, rather than a purpose-built “agent sandbox SDK”.

---

## If you want to self-host (or build your own E2B-like runner)

- **Microsandbox (self-hosted)** — microVM-based “secure execution of untrusted user or AI-generated code”. ([github.com](https://github.com/zerocore-ai/microsandbox?utm_source=openai))  
- **Agent Sandbox (Kubernetes SIG project)** — standardized K8s API for running untrusted agent code; supports **gVisor and Kata Containers** backends. ([agent-sandbox.sigs.k8s.io](https://agent-sandbox.sigs.k8s.io/?utm_source=openai))  
- Core building blocks (mix & match):
  - **Firecracker** microVM VMM (secure, multi-tenant microVMs). ([github.com](https://github.com/firecracker-microvm/firecracker?utm_source=openai))  
  - **Kata Containers** (container UX with lightweight VMs). ([katacontainers.org](https://katacontainers.org/?utm_source=openai))  
  - **gVisor** (userspace kernel / sandboxed containers). ([gvisor.dev](https://gvisor.dev/docs/?utm_source=openai))  
  - **nsjail** (namespaces + cgroups + rlimits + seccomp-bpf). ([github.com](https://github.com/google/nsjail?utm_source=openai))  
  - (Python-focused) **CodeJail** (AppArmor-based confinement). ([github.com](https://github.com/openedx/codejail?utm_source=openai))  

---

## How to pick quickly (rule of thumb)

- Want **microVM / dedicated-kernel isolation** (closest to E2B’s Firecracker model)?  
  **Vercel Sandboxes**, **Northflank**, or **Fly Machines**. ([vercel.com](https://vercel.com/docs/vercel-sandbox/concepts?utm_source=openai))

- Want a **simple developer-facing SDK** to run lots of tests/jobs in parallel with good controls?  
  **Modal Sandboxes**. ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))

- Want to run sandboxes **globally / at the edge** (and you already use Workers)?  
  **Cloudflare Sandboxes**. ([workers.cloudflare.com](https://workers.cloudflare.com/product/sandboxes?utm_source=openai))

---

## 3 questions so I can narrow to the best 2–3 options for you
1) Do you require **microVM-grade isolation** (dedicated kernel), or is **gVisor/nsjail** acceptable?  
2) What do you need to run: **full repo tests** (e.g., `pytest`, `npm test`, `cargo test`) or just **snippet execution**?  
3) Any hard requirements on **language**, **GPU**, **internet egress allowlisting**, or **self-host/BYOC**?