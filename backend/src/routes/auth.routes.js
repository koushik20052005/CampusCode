import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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

// v6.20: OTP resend — one send per email every 5 minutes, so a
// student can always resend 5 minutes after their last request.
// Keyed by email (not IP) so students sharing one Wi-Fi network
// never block each other.
const otpSendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return email || ipKeyGenerator(req.ip);
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "OTP already sent. You can resend it after 5 minutes." },
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