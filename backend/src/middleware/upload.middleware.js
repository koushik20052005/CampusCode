import multer from "multer";
import path from "path";
import fs from "fs";

/* =========================================================
   RULES PDF UPLOAD CONFIGURATION
   ========================================================= */

// Create uploads directory if it doesn't exist
const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "rules"
);

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

/* =========================================================
   MAGIC-BYTE VERIFICATION
   Extension + mimetype are client-controlled and spoofable.
   A real PDF always starts with the "%PDF-" signature.
========================================================= */

const PDF_SIGNATURE = Buffer.from("%PDF-");

export function isPdfBuffer(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= PDF_SIGNATURE.length &&
    buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
  );
}

export function verifyPdfMagicBytes(filePath) {
  const handle = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(8);
    fs.readSync(handle, header, 0, 8, 0);
    return isPdfBuffer(header);
  } finally {
    fs.closeSync(handle);
  }
}

/* =========================================================
   STORAGE
   ========================================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const hackathonId = req.params.hackathonId;

    const extension = path.extname(file.originalname);

    const filename =
      `rules-${hackathonId}-${Date.now()}${extension}`;

    cb(null, filename);
  },
});

/* =========================================================
   FILE FILTER
   ========================================================= */

const fileFilter = (req, file, cb) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const mimeType = file.mimetype;

  if (
    extension === ".pdf" &&
    mimeType === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(
      new Error("Only PDF files are allowed for hackathon rules")
    );
  }
};

/* =========================================================
   MULTER
   ========================================================= */

const rawUploadRulesPDF = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

/* =========================================================
   VERIFIED SINGLE-FILE UPLOAD
   Use uploadVerifiedRulesPDF instead of uploadRulesPDF.single()
   so spoofed non-PDF files are rejected AND deleted.
========================================================= */

export function uploadVerifiedRulesPDF(fieldName) {
  const single = rawUploadRulesPDF.single(fieldName);
  return (req, res, next) => {
    single(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) return next();
      try {
        if (!verifyPdfMagicBytes(req.file.path)) {
          fs.unlinkSync(req.file.path);
          return next(
            new Error("Uploaded file failed PDF signature verification")
          );
        }
      } catch (verifyError) {
        try {
          if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch { /* cleanup best-effort */ }
        return next(
          new Error("Could not verify uploaded PDF file")
        );
      }
      return next();
    });
  };
}

export default rawUploadRulesPDF;