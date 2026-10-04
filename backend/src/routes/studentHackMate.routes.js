import express from "express";

import {
  getHackMateRecommendations,
} from "../controllers/studentHackMate.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = express.Router();


/* =========================================================
   GET HACKMATE RECOMMENDATIONS
========================================================= */

router.get(
  "/:hackathonId",
  requireAuth,
  getHackMateRecommendations
);


export default router;