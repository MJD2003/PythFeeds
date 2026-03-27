module.exports = (err, req, res, next) => {
  const msg = err.message || "Internal server error";
  console.error(`[Error] ${req.method} ${req.path}:`, msg);

  // Detect Gemini quota / rate-limit errors and surface them as friendly 429s
  if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests") || msg.includes("rate limit")) {
    return res.status(429).json({
      error: true,
      message: "AI is temporarily busy — please wait a moment and try again.",
      retryAfter: 30,
    });
  }

  res.status(err.status || 500).json({
    error: true,
    message: req.path.startsWith("/api/ai") ? "AI analysis temporarily unavailable" : msg,
  });
};
