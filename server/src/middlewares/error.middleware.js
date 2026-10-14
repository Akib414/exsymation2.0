import logger from "../utils/logger.js";

function notFound(req, res, next) {
  const err = new Error(`Not found - ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  logger.error({
    message: err.message,
    stack: err.stack,
    status,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate key" });
  }

  // Zod validation failures carry field details — safe to expose (format only).
  if (err.status === 400 && err.details) {
    return res.status(400).json({ error: err.message, details: err.details });
  }

  // Stacks only in development — never in production or test.
  if (process.env.NODE_ENV === "development") {
    return res.status(status).json({ error: err.message, stack: err.stack });
  }

  return res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
  });
}

export { notFound, errorHandler };
