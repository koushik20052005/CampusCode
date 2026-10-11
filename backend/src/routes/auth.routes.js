import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.middleware.js";

import {
  register,
  login,
  getMe,
  preLogin,
  getCaptcha,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import {
  sendOtp,
  verifyOtpHandler,
} from "../controllers/authOtp.controller.js";

// v6.10: OTP endpoints — free via Gmail SMTP, master-OTP fallback
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP requests. Try again in 15 minutes." },
});
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Try again in 15 minutes." },
});

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

router.post("/pre-login", otpVerifyLimiter, preLogin);
router.get("/captcha", getCaptcha);
router.post("/forgot-password", otpSendLimiter, forgotPassword);
router.post("/reset-password", otpVerifyLimiter, resetPassword);
router.post("/send-otp", otpSendLimiter, sendOtp);
router.post("/verify-otp", otpVerifyLimiter, verifyOtpHandler);

export default router;