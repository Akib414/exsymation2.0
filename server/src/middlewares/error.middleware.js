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

  if (process.env.NODE_ENV === "production") {
    return res.status(status).json({
      error: status === 500 ? "Internal server error" : err.message,
    });
  }

  return res.status(status).json({ error: err.message, stack: err.stack });
}

export { notFound, errorHandler };
