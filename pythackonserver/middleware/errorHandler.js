module.exports = (err, req, res, next) => {
  const msg = err.message || "Internal server error";
  const status = err.status || 500;
  console.error(`[Error] ${req.method} ${req.path}:`, msg);

  // Detect Gemini quota / rate-limit errors and surface them as friendly 429s
  if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests") || msg.includes("rate limit")) {
    return res.status(429).json({
      error: true,
      message: "AI is temporarily busy — please wait a moment and try again.",
      retryAfter: 30,
    });
  }

  // Client-facing message
  let clientMessage = msg;
  if (req.path.startsWith("/api/ai")) {
    if (status === 500) {
      clientMessage = "AI analysis temporarily unavailable";
    }
    if (status === 503 && msg.includes("GEMINI_API_KEY")) {
      clientMessage = msg;
    }
    if (status === 400 || status === 429) {
      clientMessage = msg;
    }
  }

  res.status(status).json({
    error: true,
    message: clientMessage,
  });
};
