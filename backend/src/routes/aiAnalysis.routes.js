import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getAnalysisStatus } from "../controllers/aiAnalysis.controller.js";

const router = express.Router();

// All analysis-status reads require authentication
router.use(requireAuth);

router.get("/status/:hackathonId", getAnalysisStatus);

export default router;
