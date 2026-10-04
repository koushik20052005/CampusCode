import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";

import {
  register,
  login,
  getMe,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post(
  "/register",
  register
);
router.get("/me", requireAuth, getMe);

router.post(
  "/login",
  login
);

export default router;