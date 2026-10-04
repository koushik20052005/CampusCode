import express from "express";

import {
  getDefaultRules,
  useDefaultRules,
  getRules,
  askRuleBot,
  deleteRules,
} from "../controllers/rulebot.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// ============================================================
// GET CAMPUSCODE DEFAULT RULES
// ============================================================

router.get(
  "/default-rules",
  requireAuth,
  getDefaultRules
);

// ============================================================
// APPROVE DEFAULT RULES FOR HACKATHON
// Organizer / Admin
// ============================================================

router.post(
  "/:hackathonId/rules/default",
  requireAuth,
  requireRole(
    "ORGANIZER",
    "ADMIN"
  ),
  useDefaultRules
);

// ============================================================
// GET ACTIVE RULES
// Student / Organizer / Admin
// ============================================================

router.get(
  "/:hackathonId/rules",
  requireAuth,
  getRules
);

// ============================================================
// ASK RULEBOT
// Student / Organizer / Admin
// ============================================================

router.post(
  "/:hackathonId/ask",
  requireAuth,
  askRuleBot
);

// ============================================================
// RESET RULEBOT
// Organizer / Admin
// ============================================================

router.delete(
  "/:hackathonId/rules",
  requireAuth,
  requireRole(
    "ORGANIZER",
    "ADMIN"
  ),
  deleteRules
);

export default router;