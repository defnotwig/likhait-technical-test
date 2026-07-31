class FailOnFlakyReporter {
  onEnd(result) {
    if (result.status !== "passed") return;

    // Playwright normally returns success when a retry passes. A qualification
    // run treats any retry as a reproducibility failure.
    if (process.env.PLAYWRIGHT_HAD_RETRY === "1") process.exitCode = 1;
  }

  onTestEnd(_test, result) {
    if (result.retry > 0) process.env.PLAYWRIGHT_HAD_RETRY = "1";
  }
}

export default FailOnFlakyReporter;
