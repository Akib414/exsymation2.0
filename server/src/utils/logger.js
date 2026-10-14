import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import winston from "winston";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(__dirname, "../../logs");
fs.mkdirSync(logDir, { recursive: true });

const isProd = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logDir, "combined.log") }),
  ],
});

if (!isProd) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

// Morgan writes HTTP lines here: morgan("combined", { stream: logger.stream }).
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

export default logger;
