import express from "express";

import {
  verifyCertificate,
  listMyCertificates,
  listHackathonCertificates,
  issueParticipation,
  issueWinners,
  downloadCertificate,
} from "../controllers/certificates.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";


const router = express.Router();


/* =========================================================
   PUBLIC VERIFICATION (no auth — QR scanners may be guests)
   GET /api/certificates/verify/:code
========================================================= */

router.get(
  "/verify/:code",
  verifyCertificate
);


/* =========================================================
   STUDENT
========================================================= */

router.get(
  "/mine",
  requireAuth,
  requireRole("STUDENT"),
  listMyCertificates
);


/* =========================================================
   DOWNLOAD (owner, hackathon organizer, or ADMIN)
========================================================= */

router.get(
  "/:id/download",
  requireAuth,
  downloadCertificate
);


/* =========================================================
   ORGANIZER
========================================================= */

router.get(
  "/hackathons/:hackathonId",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  listHackathonCertificates
);

router.post(
  "/hackathons/:hackathonId/issue-participation",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  issueParticipation
);

router.post(
  "/hackathons/:hackathonId/issue-winners",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  issueWinners
);


export default router;
