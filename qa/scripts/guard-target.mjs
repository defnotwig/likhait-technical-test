const loopbackNames = new Set(["127.0.0.1", "localhost", "::1", "backend"]);

export function assertSafeTarget(rawUrl) {
  const target = new URL(rawUrl);
  if (process.env.QA_ALLOW_REMOTE === "1") return target;
  if (!loopbackNames.has(target.hostname)) {
    throw new Error(
      `Refusing qualification traffic to non-loopback target ${target.hostname}. Set QA_ALLOW_REMOTE=1 only with explicit authorization.`,
    );
  }
  return target;
}
