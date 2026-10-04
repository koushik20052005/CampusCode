import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pool from "./config/db.js";

/* =========================================================
   MONITORING MIDDLEWARE
========================================================= */

import {
  monitoringMiddleware,
} from "./middleware/monitoring.middleware.js";

/* =========================================================
   GENERAL ROUTES
========================================================= */

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminUserRoutes from "./routes/adminUser.routes.js";

import hackathonRoutes from "./routes/hackathon.routes.js";
import teamRoutes from "./routes/team.routes.js";
import projectRoutes from "./routes/project.routes.js";

import submissionRoutes from "./routes/submission.routes.js";
import evaluationRoutes from "./routes/evaluation.routes.js";

import notificationRoutes from "./routes/notification.routes.js";

/* =========================================================
   RESULT ROUTES
========================================================= */

import resultsRoutes from "./routes/results.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import resultRequestRoutes from "./routes/resultRequest.routes.js";
import adminResultRequestRoutes from "./routes/adminResultRequest.routes.js";

/* =========================================================
   ROUND ROUTES
========================================================= */

import round2Routes from "./routes/round2.routes.js";
import round2AIRoutes from "./routes/round2AI.routes.js";
import round2DecisionRoutes from "./routes/round2Decision.routes.js";
import round3Routes from "./routes/round3.routes.js";
import ideaCheckRoutes from "./routes/ideacheck.routes.js";

/* =========================================================
   ORGANIZER ROUTES
========================================================= */

import organizerRound1Routes from "./routes/organizerRound1.routes.js";
import organizerRound2Routes from "./routes/organizerRound2.routes.js";
import organizerRound3Routes from "./routes/organizerRound3.routes.js";
import finalRoutes from "./routes/final.routes.js";

/* =========================================================
   STUDENT ROUTES
========================================================= */

import studentResultRoutes from "./routes/studentResult.routes.js";
import studentHackathonRoutes from "./routes/studentHackathon.routes.js";
import studentTeamRoutes from "./routes/studentTeam.routes.js";
import studentProjectRoutes from "./routes/studentProject.routes.js";
import studentWorkspaceRoutes from "./routes/studentWorkspace.routes.js";

import studentRound1Routes from "./routes/studentRound1.routes.js";
import studentRound2Routes from "./routes/studentRound2.routes.js";
import studentRound3Routes from "./routes/studentRound3.routes.js";

import studentNotificationRoutes from "./routes/studentNotification.routes.js";
import studentDigitalIdRoutes from "./routes/studentDigitalId.routes.js";
import studentProfileRoutes from "./routes/studentProfile.routes.js";
import studentHackMateRoutes from "./routes/studentHackMate.routes.js";

/* =========================================================
   DASHBOARD ROUTES
========================================================= */

import studentDashboardRoutes from "./routes/studentDashboard.routes.js";
import organizerDashboardRoutes from "./routes/organizer-dashboard.routes.js";
import adminDashboardRoutes from "./routes/admin-dashboard.routes.js";

/* =========================================================
   AI / RULEBOT
========================================================= */

import aiRoutes from "./routes/ai.routes.js";
import rulebotRoutes from "./routes/rulebot.routes.js";

/* =========================================================
   MONITORING ROUTES
========================================================= */

import monitoringRoutes from "./routes/monitoring.routes.js";

/* =========================================================
   ENVIRONMENT
========================================================= */

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173",

    credentials: true,
  })
);

/* =========================================================
   BODY PARSER
========================================================= */

app.use(express.json());

/* =========================================================
   LIVE API MONITORING
   Must be before API routes
========================================================= */

app.use(monitoringMiddleware);

/* =========================================================
   ROOT ROUTE
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CampusCode API is running",
  });
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS time"
    );

    res.json({
      success: true,
      service: "CampusCode Backend",
      status: "healthy",
      database: "connected",
      databaseTime: result.rows[0].time,
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      service: "CampusCode Backend",
      status: "unhealthy",
      database: "disconnected",
      error: {
        message:
          error?.message ||
          "Database connection failed",
        code:
          error?.code ||
          "NO_CODE",
      },
    });
  }
});

/* =========================================================
   AUTH
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   USERS
========================================================= */

app.use(
  "/api/users",
  userRoutes
);

/* =========================================================
   ADMIN USERS
========================================================= */

app.use(
  "/api/users/admin",
  adminUserRoutes
);

/* =========================================================
   HACKATHONS
========================================================= */

app.use(
  "/api/hackathons",
  hackathonRoutes
);

/* =========================================================
   TEAMS
========================================================= */

app.use(
  "/api/teams",
  teamRoutes
);

/* =========================================================
   PROJECTS
========================================================= */

app.use(
  "/api/projects",
  projectRoutes
);

/* =========================================================
   SUBMISSIONS
========================================================= */

app.use(
  "/api/submissions",
  submissionRoutes
);

/* =========================================================
   EVALUATIONS
========================================================= */

app.use(
  "/api/evaluations",
  evaluationRoutes
);

/* =========================================================
   NOTIFICATIONS
========================================================= */

app.use(
  "/api/notifications",
  notificationRoutes
);

/* =========================================================
   RESULTS
========================================================= */

app.use(
  "/api/results",
  resultsRoutes
);

/* =========================================================
   LEADERBOARD
========================================================= */

app.use(
  "/api/leaderboard",
  leaderboardRoutes
);

/* =========================================================
   RESULT REQUESTS
========================================================= */

app.use(
  "/api/result-requests",
  resultRequestRoutes
);

app.use(
  "/api/admin/result-requests",
  adminResultRequestRoutes
);

/* =========================================================
   ROUND 2
========================================================= */

app.use(
  "/api/round2",
  round2Routes
);

app.use(
  "/api/round2-ai",
  round2AIRoutes
);

app.use(
  "/api/round2-decision",
  round2DecisionRoutes
);

/* =========================================================
   ROUND 3
========================================================= */

app.use(
  "/api/round3",
  round3Routes
);

/* =========================================================
   STUDENT RESULTS
========================================================= */

app.use(
  "/api/student/results",
  studentResultRoutes
);

/* =========================================================
   STUDENT HACKATHONS
========================================================= */

app.use(
  "/api/student/hackathons",
  studentHackathonRoutes
);

/* =========================================================
   STUDENT TEAM
========================================================= */

app.use(
  "/api/student/team",
  studentTeamRoutes
);

/* =========================================================
   STUDENT PROJECT
========================================================= */

app.use(
  "/api/student/project",
  studentProjectRoutes
);

/* =========================================================
   STUDENT WORKSPACE
========================================================= */

app.use(
  "/api/student/workspace",
  studentWorkspaceRoutes
);

/* =========================================================
   STUDENT ROUND 1
========================================================= */

app.use(
  "/api/student/round1",
  studentRound1Routes
);

/* =========================================================
   STUDENT ROUND 2
========================================================= */

app.use(
  "/api/student/round2",
  studentRound2Routes
);

/* =========================================================
   STUDENT ROUND 3
========================================================= */

app.use(
  "/api/student/round3",
  studentRound3Routes
);

/* =========================================================
   STUDENT NOTIFICATIONS
========================================================= */

app.use(
  "/api/student/notifications",
  studentNotificationRoutes
);

/* =========================================================
   STUDENT DIGITAL ID
========================================================= */

app.use(
  "/api/student/digital-id",
  studentDigitalIdRoutes
);

/* =========================================================
   STUDENT PROFILE
========================================================= */

app.use(
  "/api/student/profile",
  studentProfileRoutes
);

/* =========================================================
   STUDENT HACKMATE
========================================================= */

app.use(
  "/api/student/hackmate",
  studentHackMateRoutes
);

/* =========================================================
   STUDENT DASHBOARD
========================================================= */

app.use(
  "/api/student/dashboard",
  studentDashboardRoutes
);

/* =========================================================
   ORGANIZER ROUND 1
========================================================= */

app.use(
  "/api/organizer/round1",
  organizerRound1Routes
);

/* =========================================================
   ORGANIZER ROUND 2
========================================================= */

app.use(
  "/api/organizer/round2",
  organizerRound2Routes
);

/* =========================================================
   ORGANIZER ROUND 3
========================================================= */

app.use(
  "/api/organizer/round3",
  organizerRound3Routes
);

/* =========================================================
   ORGANIZER FINAL
========================================================= */

app.use(
  "/api/organizer/final",
  finalRoutes
);

/* =========================================================
   IDEA CHECK
========================================================= */

app.use(
  "/api/ideacheck",
  ideaCheckRoutes
);

/* =========================================================
   ORGANIZER DASHBOARD
========================================================= */

app.use(
  "/api/dashboard",
  organizerDashboardRoutes
);

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

app.use(
  "/api/dashboard",
  adminDashboardRoutes
);

/* =========================================================
   GEMINI AI
========================================================= */

app.use(
  "/api/ai",
  aiRoutes
);

/* =========================================================
   RULEBOT
========================================================= */

app.use(
  "/api/rulebot",
  rulebotRoutes
);

/* =========================================================
   SYSTEM MONITORING
========================================================= */

app.use(
  "/api/monitoring",
  monitoringRoutes
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    req.monitoringError =
      error?.message ||
      "Unknown server error";

    console.error(
      "Server error:",
      {
        message:
          error?.message ||
          "Unknown server error",

        code:
          error?.code ||
          "NO_CODE",

        name:
          error?.name ||
          "UnknownError",

        stack:
          error?.stack ||
          null,
      }
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `CampusCode API running on port ${PORT}`
    );

    console.log(
      "System Monitoring API: /api/monitoring"
    );

    console.log(
      "Live API Monitoring Middleware: ENABLED"
    );
  }
);