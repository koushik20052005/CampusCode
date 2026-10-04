import express from "express";

import {
  getPendingResultRequests,
  reviewResultRequest,
} from "../controllers/adminResults.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/pending",
  requireAuth,
  getPendingResultRequests
);

router.patch(
  "/:requestId",
  requireAuth,
  reviewResultRequest
);

export default router;