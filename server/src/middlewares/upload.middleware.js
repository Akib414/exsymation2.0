import multer from "multer";
import path from "path";
import { fileTypeFromBuffer } from "file-type";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Extension pre-check only — real validation is verifyFileType below.
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const okExt = [".jpg", ".jpeg", ".png", ".webp", ".pdf"].includes(ext);
  if (!okExt || !ALLOWED_MIMES.has(file.mimetype)) {
    return cb(badRequest("File type not allowed"));
  }
  cb(null, true);
}

// Memory only — never write uploads to backend disk (ship to S3/Cloudinary later).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter,
});

// Magic-number check — rejects spoofed files (e.g. .exe renamed to .jpg).
async function verifyFileType(req, res, next) {
  try {
    if (!req.file) return next();
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
      return next(badRequest("File content does not match its type"));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export { upload, verifyFileType, ALLOWED_MIMES, MAX_FILE_SIZE };
