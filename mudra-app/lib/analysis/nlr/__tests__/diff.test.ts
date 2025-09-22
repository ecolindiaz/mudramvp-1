import { computeDelta, formatPercent, clampDelta } from "@/lib/analysis/nlr/diff";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ ${name}`);
      console.error((err as Error).message);
      failed++;
    }
  }

  test("handles both nulls", () => {
    const d = computeDelta(null, null);
    assert(d.current === null && d.previous === null, "both nulls");
  });

  test("computes absolute and relative with default thresholds", () => {
    const d = computeDelta(110, 100);
    assert(d.absolute === 10, "absolute should be 10");
    assert(d.relative && Math.abs(d.relative - 0.1) < 1e-6, "relative should be 0.1");
    assert(d.notable === true, "10% should be notable");
  });

  test("formatPercent", () => {
    assert(formatPercent(0.123) === "12.3%", "format 12.3%");
    assert(formatPercent(null) === "0%", "format 0%");
  });

  test("clampDelta clamps current and recomputes", () => {
    const d = computeDelta(105, 100);
    const c = clampDelta(d, 0, 102);
    assert(c.current === 102, "current should be clamped to 102");
    assert(c.absolute === 2, "absolute should be 2 after clamp");
  });

  console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();


