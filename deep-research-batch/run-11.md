# Run 11
> **ID:** `resp_0ca29c5ff47041ea00699d709f1a5881938ec090ecd03d941f`

## Token Usage
- Input: 34,823
- Output: 3,761
- Reasoning: 2,788
- Total: 38,584

## Search Calls

### Search 1: `e2b.dev sandbox for AI generated code what is it`
  - e2b.dev sandbox for AI generated code what is it
  - alternatives to E2B sandbox for LLM code execution
  - secure code execution sandbox API for untrusted code Firecracker gVisor WASI
  - Cloudflare Workers AI code execution sandbox for untrusted code

### Search 2: `Judge0 open source online code execution sandbox Docker isolation`
  - Judge0 open source online code execution sandbox Docker isolation
  - Piston API execute code in many languages sandbox
  - Modal sandbox untrusted code execution serverless containers security isolation
  - AWS Lambda Firecracker microVM isolation untrusted code

### Search 3: `Vercel Sandbox beta Firecracker`
  - Vercel Sandbox beta Firecracker
  - Daytona secure sandbox provisioning AI workflows
  - Kata Containers microVM isolation for containers
  - gVisor sandboxed container runtime documentation

### Search 4: `Google nsjail sandbox untrusted code README`
  - Google nsjail sandbox untrusted code README
  - firejail Linux sandbox untrusted applications namespaces seccomp
  - bubblewrap sandboxing tool flatpak untrusted code
  - Kata Containers microVM container runtime documentation

### Search 5: `github google nsjail sandbox README`
  - github google nsjail sandbox README
  - NsJail is a process isolation tool using Linux namespaces cgroups seccomp
  - wasmtime WASI sandbox run untrusted code
  - Pyodide run python in browser wasm sandbox

## Sites Referenced

- [Sandboxes | Modal Docs](https://modal.com/docs/guide/sandboxes?utm_source=openai)
- [Cloudflare Sandboxes - Secure Code Execution](https://workers.cloudflare.com/product/sandboxes?utm_source=openai)
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox/?utm_source=openai)
- [Hopx - Secure Sandboxes for AI Agents | Run Untrusted Code Safely](https://hopx.ai/use-cases/execute-untrusted-code/?utm_source=openai)
- [Daytona | Secure AI Code Execution Platform](https://daytonadocs.com/?utm_source=openai)
- [Docker Sandboxes | Docker Docs](https://docs.docker.com/ai/sandboxes/?utm_source=openai)
- [What is gVisor? - gVisor](https://gvisor.dev/docs/?utm_source=openai)
- [Kata Containers - Open Source Container Runtime Software | Kata Containers](https://katacontainers.io/?utm_source=openai)
- [GitHub - firecracker-microvm/firecracker: Secure and fast microVMs for serverless computing.](https://github.com/firecracker-microvm/firecracker?utm_source=openai)
- [GitHub - google/nsjail: A lightweight process isolation tool that utilizes Linux namespaces, cgroups, rlimits and seccomp-bpf syscall filters, leveraging the Kafel BPF language for enhanced security.](https://github.com/google/nsjail?utm_source=openai)
- [GitHub - engineer-man/piston: A high performance general purpose code execution engine.](https://github.com/engineer-man/piston?utm_source=openai)
- [Security - Wasmtime](https://docs.wasmtime.dev/security.html?utm_source=openai)
- [Pyodide – Run Python in Browser with WebAssembly](https://pyodide.com/?utm_source=openai)

## Products Mentioned

Cloudflare, Daytona, Docker, E2B, Firecracker, Kata Containers, Modal, Piston, Spin, Vercel Sandbox, Wasmtime, gVisor, nsjail

## Final Report

Here are solid **e2b.dev alternatives** for **securely testing/executing AI-generated (untrusted) code**, grouped by “hosted like E2B” vs “self-host / local”.

## Hosted / API sandboxes (closest to E2B)
1. **Modal Sandboxes** — run untrusted code inside “sandbox” containers with controls like fresh-per-run containers and optional network blocking. ([modal.com](https://modal.com/docs/guide/sandboxes?utm_source=openai))  
2. **Cloudflare Sandboxes (Workers)** — SDK to spin up isolated Linux containers from a Worker; aimed at running untrusted/AI-generated code with fast startup. ([workers.cloudflare.com](https://workers.cloudflare.com/product/sandboxes?utm_source=openai))  
3. **Vercel Sandbox** — ephemeral compute primitive designed to run untrusted/user-generated code; uses **Firecracker microVM** isolation and has SDK/CLI. ([vercel.com](https://vercel.com/docs/vercel-sandbox/?utm_source=openai))  
4. **Hopx** — “run untrusted code” product built around **Firecracker microVMs**, with configurable resource and network controls. ([hopx.ai](https://hopx.ai/use-cases/execute-untrusted-code/?utm_source=openai))  
5. **Daytona** — positioned specifically as a secure, stateful execution platform for AI-generated code/agent workflows. ([daytonadocs.com](https://daytonadocs.com/?utm_source=openai))  

## Local dev-machine isolation (good for “test before you run it”)
- **Docker Sandboxes (Docker Desktop)** — runs AI coding agents in **microVM-based sandboxes** with a private Docker daemon; useful to keep agents off your host OS. ([docs.docker.com](https://docs.docker.com/ai/sandboxes/?utm_source=openai))  

## Self-host building blocks (if you want full control / on‑prem)
- **gVisor (`runsc`)** — OCI runtime that sandboxes containers with an “application kernel” layer for stronger isolation than plain `runc`. ([gvisor.dev](https://gvisor.dev/docs/?utm_source=openai))  
- **Kata Containers** — container runtime that runs workloads in lightweight VMs (stronger isolation; integrates with the container ecosystem). ([katacontainers.io](https://katacontainers.io/?utm_source=openai))  
- **Firecracker** — build your own microVM-based runner (more engineering, maximum control). ([github.com](https://github.com/firecracker-microvm/firecracker?utm_source=openai))  
- **nsjail** — process isolation using Linux namespaces/cgroups/rlimits/seccomp; often used to sandbox CLI programs. ([github.com](https://github.com/google/nsjail?utm_source=openai))  

## Open-source “code execution engines” (judge-style runners)
- **Piston** — executes many languages using an Isolate-based sandbox with resource limits and (by default) no outbound network. ([github.com](https://github.com/engineer-man/piston?utm_source=openai))  

## WASM-based approach (strong sandboxing, but more constraints)
- **Wasmtime / WASI** — WebAssembly runtimes are designed to execute untrusted code in a sandboxed model (capability-style access), great when you can fit your workload into WASM constraints. ([docs.wasmtime.dev](https://docs.wasmtime.dev/security.html?utm_source=openai))  
- For Python specifically, **Pyodide** can run Python in a WebAssembly sandbox (often more “safe by default,” but package/support limits apply). ([pyodide.com](https://pyodide.com/?utm_source=openai))  

---

## Picking the right option (quick heuristic)
- **Need “E2B-like” remote sandboxes + easy SDK:** Modal / Cloudflare / Vercel / Hopx
- **Need the strongest isolation boundary (microVM):** Vercel / Hopx / (DIY Firecracker) / Kata
- **Need self-hosted and Kubernetes-friendly:** gVisor or Kata
- **Need a coding-challenge style runner for many langs:** Piston (+ your own perimeter)

## Minimum hardening checklist (regardless of platform)
- Run in a **fresh environment per execution** (avoid cross-run data leakage).
- **No secrets** in env/filesystem; use a separate account/project with no prod access.
- **Default-deny network**, then allowlist only what tests truly need.
- Enforce **CPU/mem/time/output** limits; kill runaway processes.

If you tell me:
1) languages (Python? Node? “any CLI”?)  
2) do tests need internet/package installs?  
3) local-only vs hosted, and expected concurrency  

…I can recommend 2–3 best-fit options and a reference architecture.