import express from "express";

import {
  getHackMateRecommendations,
  findHackMateByCampusId,
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

/* =========================================================
   FIND STUDENT BY CAMPUSCODE ID
   (HackMate Search-by-ID + QR scan target)
========================================================= */

router.get(
  "/:hackathonId/find/:campusId",
  requireAuth,
  findHackMateByCampusId
);


export default router;