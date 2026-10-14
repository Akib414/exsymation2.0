import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import logger from "./src/utils/logger.js";
import app from "./src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on("uncaughtException", (err) => {
  logger.error({ message: "Uncaught exception", error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ message: "Unhandled rejection", error: err.message, stack: err.stack });
  server.close(() => process.exit(1));
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  // Close DB connections here (see src/config/db.js).
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
