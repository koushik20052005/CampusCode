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

const uploadRulesPDF = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

export default uploadRulesPDF;