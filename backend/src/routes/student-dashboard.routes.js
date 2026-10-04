/*
  LEGACY STUDENT DASHBOARD ROUTES

  The official dashboard route is now:

  /api/student/dashboard

  handled by:

  studentDashboard.routes.js

  This file intentionally exports an empty router so that
  an old server.js import cannot create a second dashboard
  endpoint.
*/

import express from "express";

const router = express.Router();

export default router;