import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import logger from "./src/utils/logger.js";
import app from "./src/app.js";
import { connectDB, disconnectDB } from "./src/config/db.js";
import { assertSecretsDistinct } from "./src/utils/jwt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Fail fast if teacher/admin secrets are missing or equal.
assertSecretsDistinct();
if (!process.env.JWT_SECRET || !process.env.JWT_ADMIN_SECRET) {
  logger.error({ message: "JWT secrets missing — set JWT_SECRET and JWT_ADMIN_SECRET" });
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

let server;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    logger.error({ message: "Failed to connect to MongoDB", error: err.message, stack: err.stack });
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

start();

process.on("uncaughtException", (err) => {
  logger.error({ message: "Uncaught exception", error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ message: "Unhandled rejection", error: err.message, stack: err.stack });
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  disconnectDB()
    .catch((err) => logger.error({ message: "Error disconnecting MongoDB", error: err.message }))
    .finally(() => {
      if (server) {
        server.close(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
