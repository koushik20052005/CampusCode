// controllers/superadmin.controller.js

import pool from "../config/db.js";

/* =========================================================
   CAMPUSCODE SUPER ADMIN CONTROLLER
   =========================================================
   This controller provides the backend foundation for the
   Super Admin Control Center.

   Main systems:
   - Student
   - Admin
   - Organizer
   - Database
   - Gemini
   - Landing Page

   Monitoring:
   - Health
   - Statistics
   - Requests
   - Errors
   - Response time
   - System blueprint
   - Maintenance mode
   - Audit events

   IMPORTANT:
   Request telemetry is stored in memory for now.
   The next backend step can move telemetry into a proper
   persistent/streaming monitoring layer.
========================================================= */


/* =========================================================
   IN-MEMORY TELEMETRY
========================================================= */

const MAX_REQUEST_LOGS = 1000;
const MAX_ERROR_LOGS = 500;

const requestLogs = [];
const errorLogs = [];

const serviceStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,

  services: {
    student: {
      requests: 0,
      errors: 0,
    },

    admin: {
      requests: 0,
      errors: 0,
    },

    organizer: {
      requests: 0,
      errors: 0,
    },

    database: {
      requests: 0,
      errors: 0,
    },

    gemini: {
      requests: 0,
      errors: 0,
    },

    landing: {
      requests: 0,
      errors: 0,
    },
  },
};


/* =========================================================
   MAINTENANCE STATE
========================================================= */

let maintenanceState = {
  enabled: false,
  message:
    "CampusCode is currently under maintenance. Please try again later.",
  startedAt: null,
  startedBy: null,
};


/* =========================================================
   HELPER - SERVICE NORMALIZER
========================================================= */

function normalizeService(value) {
  const service = String(value || "")
    .trim()
    .toLowerCase();

  if (
    service === "student" ||
    service === "students"
  ) {
    return "student";
  }

  if (
    service === "admin" ||
    service === "admins"
  ) {
    return "admin";
  }

  if (
    service === "organizer" ||
    service === "organizers"
  ) {
    return "organizer";
  }

  if (
    service === "database" ||
    service === "db"
  ) {
    return "database";
  }

  if (
    service === "gemini" ||
    service === "ai"
  ) {
    return "gemini";
  }

  if (
    service === "landing" ||
    service === "landing-page" ||
    service === "public"
  ) {
    return "landing";
  }

  return "landing";
}


/* =========================================================
   HELPER - ADD REQUEST
========================================================= */

export function recordSuperAdminRequest({
  method,
  path,
  statusCode,
  responseTime,
  service,
  userId = null,
  userRole = null,
  requestId = null,
  ip = null,
}) {
  const normalizedService = normalizeService(service);

  const duration = Number(responseTime) || 0;
  const status = Number(statusCode) || 200;

  const record = {
    id:
      requestId ||
      `REQ-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`,

    method: String(method || "GET").toUpperCase(),

    path: path || "/",

    statusCode: status,

    responseTime: duration,

    service: normalizedService,

    userId: userId || null,

    userRole: userRole || null,

    ip: ip || null,

    timestamp: new Date().toISOString(),

    success:
      status >= 200 &&
      status < 400,
  };

  requestLogs.unshift(record);

  if (requestLogs.length > MAX_REQUEST_LOGS) {
    requestLogs.length = MAX_REQUEST_LOGS;
  }

  serviceStats.totalRequests += 1;

  serviceStats.totalResponseTime += duration;

  if (
    status >= 200 &&
    status < 400
  ) {
    serviceStats.successfulRequests += 1;
  } else {
    serviceStats.failedRequests += 1;
  }

  if (
    serviceStats.services[normalizedService]
  ) {
    serviceStats.services[
      normalizedService
    ].requests += 1;

    if (status >= 400) {
      serviceStats.services[
        normalizedService
      ].errors += 1;
    }
  }

  return record;
}


/* =========================================================
   HELPER - ADD ERROR
========================================================= */

export function recordSuperAdminError({
  message,
  method,
  path,
  statusCode = 500,
  service = "landing",
  userId = null,
  userRole = null,
  stack = null,
  requestId = null,
}) {
  const normalizedService =
    normalizeService(service);

  const errorRecord = {
    id:
      requestId ||
      `ERR-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`,

    message:
      message ||
      "Unknown system error",

    method:
      String(method || "GET").toUpperCase(),

    path:
      path || "/",

    statusCode:
      Number(statusCode) || 500,

    service:
      normalizedService,

    userId:
      userId || null,

    userRole:
      userRole || null,

    stack:
      stack || null,

    timestamp:
      new Date().toISOString(),
  };

  errorLogs.unshift(errorRecord);

  if (errorLogs.length > MAX_ERROR_LOGS) {
    errorLogs.length = MAX_ERROR_LOGS;
  }

  return errorRecord;
}


/* =========================================================
   GET SUPER ADMIN OVERVIEW
========================================================= */

export async function getSuperAdminOverview(
  req,
  res
) {
  try {
    let databaseStatus = "disconnected";
    let databaseLatency = null;

    const dbStartedAt = Date.now();

    try {
      await pool.query(
        "SELECT NOW() AS server_time"
      );

      databaseLatency =
        Date.now() - dbStartedAt;

      databaseStatus = "connected";
    } catch (databaseError) {
      databaseStatus = "disconnected";
    }

    let users = 0;
    let students = 0;
    let organizers = 0;
    let admins = 0;

    let hackathons = 0;
    let teams = 0;
    let submissions = 0;

    try {
      const result =
        await pool.query(`
          SELECT
            COUNT(*)::int AS total_users,

            COUNT(*) FILTER (
              WHERE role = 'STUDENT'
            )::int AS students,

            COUNT(*) FILTER (
              WHERE role = 'ORGANIZER'
            )::int AS organizers,

            COUNT(*) FILTER (
              WHERE role = 'ADMIN'
            )::int AS admins
          FROM users
        `);

      users =
        Number(
          result.rows[0]?.total_users || 0
        );

      students =
        Number(
          result.rows[0]?.students || 0
        );

      organizers =
        Number(
          result.rows[0]?.organizers || 0
        );

      admins =
        Number(
          result.rows[0]?.admins || 0
        );
    } catch (error) {
      console.error(
        "SUPER ADMIN USER STAT ERROR:",
        error.message
      );
    }

    try {
      const result =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM hackathons
        `);

      hackathons =
        Number(
          result.rows[0]?.count || 0
        );
    } catch (error) {
      console.error(
        "SUPER ADMIN HACKATHON STAT ERROR:",
        error.message
      );
    }

    try {
      const result =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM teams
        `);

      teams =
        Number(
          result.rows[0]?.count || 0
        );
    } catch (error) {
      console.error(
        "SUPER ADMIN TEAM STAT ERROR:",
        error.message
      );
    }

    try {
      const result =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM round1_submissions
        `);

      submissions +=
        Number(
          result.rows[0]?.count || 0
        );
    } catch {}

    try {
      const result =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM round2_submissions
        `);

      submissions +=
        Number(
          result.rows[0]?.count || 0
        );
    } catch {}

    try {
      const result =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM round3_submissions
        `);

      submissions +=
        Number(
          result.rows[0]?.count || 0
        );
    } catch {}

    const averageResponseTime =
      serviceStats.totalRequests > 0
        ? Math.round(
            serviceStats.totalResponseTime /
              serviceStats.totalRequests
          )
        : 0;

    const successRate =
      serviceStats.totalRequests > 0
        ? Number(
            (
              (serviceStats.successfulRequests /
                serviceStats.totalRequests) *
              100
            ).toFixed(2)
          )
        : 100;

    return res.json({
      success: true,

      system: {
        name: "CampusCode",
        status:
          databaseStatus === "connected"
            ? "operational"
            : "degraded",

        maintenance:
          maintenanceState.enabled,
      },

      services: {
        student: "online",
        admin: "online",
        organizer: "online",
        database: databaseStatus,
        gemini: "available",
        landing: "online",
      },

      database: {
        status: databaseStatus,
        latency: databaseLatency,
      },

      telemetry: {
        totalRequests:
          serviceStats.totalRequests,

        successfulRequests:
          serviceStats.successfulRequests,

        failedRequests:
          serviceStats.failedRequests,

        successRate,

        averageResponseTime,
      },

      users: {
        total: users,
        students,
        organizers,
        admins,
      },

      platform: {
        hackathons,
        teams,
        submissions,
      },

      maintenance:
        maintenanceState,
    });
  } catch (error) {
    console.error(
      "GET SUPER ADMIN OVERVIEW ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load Super Admin overview",
    });
  }
}


/* =========================================================
   SYSTEM HEALTH
========================================================= */

export async function getSystemHealth(
  req,
  res
) {
  const services = {};

  const checkDatabase =
    async () => {
      const startedAt = Date.now();

      try {
        await pool.query(
          "SELECT 1"
        );

        return {
          status: "online",
          latency:
            Date.now() - startedAt,
        };
      } catch (error) {
        return {
          status: "offline",
          latency:
            Date.now() - startedAt,
          error:
            error.message,
        };
      }
    };

  services.database =
    await checkDatabase();

  services.api = {
    status: "online",
    uptimeSeconds:
      Math.floor(
        process.uptime()
      ),
  };

  services.student = {
    status: "online",
  };

  services.admin = {
    status: "online",
  };

  services.organizer = {
    status: "online",
  };

  services.landing = {
    status: "online",
  };

  services.gemini = {
    status:
      process.env.GEMINI_API_KEY
        ? "configured"
        : "not_configured",
  };

  const onlineServices =
    Object.values(services).filter(
      (service) =>
        service.status ===
        "online"
    ).length;

  return res.json({
    success: true,

    status:
      services.database.status ===
      "online"
        ? "healthy"
        : "degraded",

    checkedAt:
      new Date().toISOString(),

    services,

    summary: {
      online:
        onlineServices,

      total:
        Object.keys(services).length,

      maintenance:
        maintenanceState.enabled,
    },
  });
}


/* =========================================================
   SYSTEM STATISTICS
========================================================= */

export async function getSystemStats(
  req,
  res
) {
  const averageResponseTime =
    serviceStats.totalRequests > 0
      ? Math.round(
          serviceStats.totalResponseTime /
            serviceStats.totalRequests
        )
      : 0;

  const successRate =
    serviceStats.totalRequests > 0
      ? Number(
          (
            (serviceStats.successfulRequests /
              serviceStats.totalRequests) *
            100
          ).toFixed(2)
        )
      : 100;

  return res.json({
    success: true,

    stats: {
      total_requests:
        serviceStats.totalRequests,

      successful_requests:
        serviceStats.successfulRequests,

      failed_requests:
        serviceStats.failedRequests,

      success_rate:
        successRate,

      average_response_time:
        averageResponseTime,

      active_errors:
        errorLogs.length,

      services:
        serviceStats.services,

      uptime_seconds:
        Math.floor(
          process.uptime()
        ),

      memory: {
        rss:
          process.memoryUsage()
            .rss,

        heapUsed:
          process.memoryUsage()
            .heapUsed,

        heapTotal:
          process.memoryUsage()
            .heapTotal,
      },
    },

    maintenance:
      maintenanceState,
  });
}


/* =========================================================
   LIVE REQUESTS
========================================================= */

export async function getLiveRequests(
  req,
  res
) {
  try {
    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 100,
        1
      ),
      500
    );

    const service =
      req.query.service
        ? normalizeService(
            req.query.service
          )
        : null;

    let records =
      service
        ? requestLogs.filter(
            (item) =>
              item.service ===
              service
          )
        : requestLogs;

    records =
      records.slice(0, limit);

    return res.json({
      success: true,

      count: records.length,

      requests: records,

      live: true,

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "GET LIVE REQUESTS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load live requests",
    });
  }
}


/* =========================================================
   LIVE ERRORS
========================================================= */

export async function getLiveErrors(
  req,
  res
) {
  try {
    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 100,
        1
      ),
      500
    );

    const service =
      req.query.service
        ? normalizeService(
            req.query.service
          )
        : null;

    let records =
      service
        ? errorLogs.filter(
            (item) =>
              item.service ===
              service
          )
        : errorLogs;

    records =
      records.slice(0, limit);

    return res.json({
      success: true,

      count: records.length,

      errors: records,

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "GET LIVE ERRORS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load live errors",
    });
  }
}


/* =========================================================
   RESPONSE TIME DATA
========================================================= */

export async function getResponseTime(
  req,
  res
) {
  try {
    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 100,
        1
      ),
      500
    );

    const responseData =
      requestLogs
        .slice(0, limit)
        .map((request) => ({
          id: request.id,

          method:
            request.method,

          endpoint:
            request.path,

          service:
            request.service,

          status_code:
            request.statusCode,

          response_time:
            request.responseTime,

          timestamp:
            request.timestamp,
        }));

    const average =
      serviceStats.totalRequests > 0
        ? Math.round(
            serviceStats.totalResponseTime /
              serviceStats.totalRequests
          )
        : 0;

    return res.json({
      success: true,

      average_response_time:
        average,

      response_time:
        responseData,

      data:
        responseData,
    });
  } catch (error) {
    console.error(
      "GET RESPONSE TIME ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load response-time data",
    });
  }
}


/* =========================================================
   SYSTEM BLUEPRINT
========================================================= */

export async function getSystemBlueprint(
  req,
  res
) {
  try {
    const blueprint = {
      id: "campuscode-core",
      type: "root",
      name: "CampusCode",
      status: "online",

      children: [
        {
          id: "student",
          type: "portal",
          name: "Student",
          status: "online",

          connections: [
            "api",
            "database",
            "gemini",
          ],

          modules: [
            {
              id: "student-auth",
              name: "Authentication",
              status: "online",
            },
            {
              id: "student-dashboard",
              name: "Dashboard",
              status: "online",
            },
            {
              id: "student-hackathons",
              name: "Hackathons",
              status: "online",
            },
            {
              id: "student-r1",
              name: "Round 1",
              status: "online",
            },
            {
              id: "student-r2",
              name: "Round 2",
              status: "online",
            },
            {
              id: "student-r3",
              name: "Round 3",
              status: "online",
            },
            {
              id: "student-team",
              name: "Team",
              status: "online",
            },
            {
              id: "student-project",
              name: "Project",
              status: "online",
            },
            {
              id: "student-results",
              name: "Results",
              status: "online",
            },
          ],
        },

        {
          id: "admin",
          type: "portal",
          name: "Admin",
          status: "online",

          connections: [
            "api",
            "database",
          ],

          modules: [
            {
              id: "admin-dashboard",
              name: "Dashboard",
              status: "online",
            },
            {
              id: "admin-users",
              name: "Participants",
              status: "online",
            },
            {
              id: "admin-teams",
              name: "Teams",
              status: "online",
            },
            {
              id: "admin-submissions",
              name: "Submissions",
              status: "online",
            },
            {
              id: "admin-results",
              name: "Leaderboard",
              status: "online",
            },
            {
              id: "admin-approval",
              name: "Result Approval",
              status: "online",
            },
          ],
        },

        {
          id: "organizer",
          type: "portal",
          name: "Organizer",
          status: "online",

          connections: [
            "api",
            "database",
            "gemini",
          ],

          modules: [
            {
              id: "organizer-dashboard",
              name: "Dashboard",
              status: "online",
            },
            {
              id: "organizer-hackathons",
              name: "Hackathons",
              status: "online",
            },
            {
              id: "organizer-r1",
              name: "Round 1",
              status: "online",
            },
            {
              id: "organizer-r2",
              name: "Round 2",
              status: "online",
            },
            {
              id: "organizer-r3",
              name: "Round 3",
              status: "online",
            },
            {
              id: "organizer-results",
              name: "Results",
              status: "online",
            },
          ],
        },

        {
          id: "database",
          type: "service",
          name: "Database",
          status:
            "online",
          connections: [
            "student",
            "admin",
            "organizer",
            "api",
          ],
        },

        {
          id: "gemini",
          type: "service",
          name: "Gemini",
          status:
            process.env.GEMINI_API_KEY
              ? "configured"
              : "not_configured",

          connections: [
            "student",
            "organizer",
            "api",
          ],

          modules: [
            {
              id: "gemini-r1",
              name: "Round 1 Analysis",
              status: "online",
            },
            {
              id: "gemini-r2",
              name: "Round 2 Analysis",
              status: "online",
            },
            {
              id: "gemini-rulebot",
              name: "RuleBot",
              status: "online",
            },
            {
              id: "gemini-ideacheck",
              name: "IdeaCheck",
              status: "online",
            },
          ],
        },

        {
          id: "landing",
          type: "portal",
          name: "Landing Page",
          status: "online",

          connections: [
            "api",
          ],
        },

        {
          id: "api",
          type: "core",
          name: "CampusCode API",
          status: "online",

          connections: [
            "student",
            "admin",
            "organizer",
            "database",
            "gemini",
            "landing",
          ],
        },
      ],

      maintenance:
        maintenanceState,
    };

    return res.json({
      success: true,
      blueprint,
    });
  } catch (error) {
    console.error(
      "GET SYSTEM BLUEPRINT ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load system blueprint",
    });
  }
}


/* =========================================================
   GET BLUEPRINT NODE
========================================================= */

export async function getBlueprintNode(
  req,
  res
) {
  try {
    const { nodeId } =
      req.params;

    const nodes = {
      student: {
        id: "student",
        name: "Student",

        pipeline: [
          "Authentication",
          "Dashboard",
          "Hackathons",
          "Round 1",
          "Round 2",
          "Round 3",
          "Team",
          "Project",
          "Submission",
          "Results",
        ],
      },

      admin: {
        id: "admin",
        name: "Admin",

        pipeline: [
          "Authentication",
          "Dashboard",
          "Participants",
          "Teams",
          "Submissions",
          "Leaderboard",
          "Result Approval",
        ],
      },

      organizer: {
        id: "organizer",
        name: "Organizer",

        pipeline: [
          "Authentication",
          "Dashboard",
          "Hackathons",
          "Round 1 AI Review",
          "Round 2 AI Review",
          "Round 3 Manual Review",
          "Results",
        ],
      },

      database: {
        id: "database",
        name: "Database",

        pipeline: [
          "Connection",
          "Queries",
          "Transactions",
          "Persistence",
        ],
      },

      gemini: {
        id: "gemini",
        name: "Gemini",

        pipeline: [
          "Request",
          "Prompt",
          "Gemini API",
          "AI Response",
          "Application",
        ],
      },

      landing: {
        id: "landing",
        name: "Landing Page",

        pipeline: [
          "Visitor",
          "Landing Page",
          "Authentication",
          "CampusCode Platform",
        ],
      },
    };

    const node =
      nodes[
        String(nodeId)
          .toLowerCase()
      ];

    if (!node) {
      return res.status(404).json({
        success: false,
        message:
          "Blueprint node not found",
      });
    }

    return res.json({
      success: true,
      node,
    });
  } catch (error) {
    console.error(
      "GET BLUEPRINT NODE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load blueprint node",
    });
  }
}


/* =========================================================
   GET MAINTENANCE MODE
========================================================= */

export async function getMaintenanceMode(
  req,
  res
) {
  return res.json({
    success: true,

    maintenance:
      maintenanceState,
  });
}


/* =========================================================
   ENABLE / DISABLE MAINTENANCE MODE
========================================================= */

export async function updateMaintenanceMode(
  req,
  res
) {
  try {
    const {
      enabled,
      message,
    } = req.body;

    if (
      typeof enabled !==
      "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "enabled must be a boolean",
      });
    }

    if (enabled) {
      maintenanceState = {
        enabled: true,

        message:
          String(
            message ||
              "CampusCode is currently under maintenance. Please try again later."
          ).trim(),

        startedAt:
          new Date().toISOString(),

        startedBy: {
          id: req.user?.id || null,

          name:
            req.user?.name ||
            null,

          email:
            req.user?.email ||
            null,
        },
      };
    } else {
      maintenanceState = {
        enabled: false,

        message:
          "CampusCode is currently under maintenance. Please try again later.",

        startedAt: null,

        startedBy: null,
      };
    }

    console.log(
      `SUPER ADMIN MAINTENANCE MODE: ${
        maintenanceState.enabled
          ? "ENABLED"
          : "DISABLED"
      }`
    );

    return res.json({
      success: true,

      message:
        maintenanceState.enabled
          ? "CampusCode maintenance mode enabled"
          : "CampusCode maintenance mode disabled",

      maintenance:
        maintenanceState,
    });
  } catch (error) {
    console.error(
      "UPDATE MAINTENANCE MODE ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update maintenance mode",
    });
  }
}


/* =========================================================
   AUDIT / RECENT ACTIVITY
========================================================= */

export async function getSystemActivity(
  req,
  res
) {
  try {
    const requestActivity =
      requestLogs
        .slice(0, 100)
        .map((item) => ({
          type: "REQUEST",

          id: item.id,

          service:
            item.service,

          method:
            item.method,

          path:
            item.path,

          status:
            item.statusCode,

          responseTime:
            item.responseTime,

          timestamp:
            item.timestamp,
        }));

    const errorActivity =
      errorLogs
        .slice(0, 100)
        .map((item) => ({
          type: "ERROR",

          id: item.id,

          service:
            item.service,

          method:
            item.method,

          path:
            item.path,

          status:
            item.statusCode,

          message:
            item.message,

          timestamp:
            item.timestamp,
        }));

    const activity = [
      ...requestActivity,
      ...errorActivity,
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp) -
          new Date(a.timestamp)
      )
      .slice(0, 150);

    return res.json({
      success: true,

      activity,

      count:
        activity.length,
    });
  } catch (error) {
    console.error(
      "GET SYSTEM ACTIVITY ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load system activity",
    });
  }
}


/* =========================================================
   CLEAR TELEMETRY
========================================================= */

export async function clearTelemetry(
  req,
  res
) {
  requestLogs.length = 0;
  errorLogs.length = 0;

  serviceStats.totalRequests = 0;
  serviceStats.successfulRequests = 0;
  serviceStats.failedRequests = 0;
  serviceStats.totalResponseTime = 0;

  Object.values(
    serviceStats.services
  ).forEach((service) => {
    service.requests = 0;
    service.errors = 0;
  });

  return res.json({
    success: true,
    message:
      "Super Admin telemetry cleared",
  });
}


/* =========================================================
   EXPORT TELEMETRY STATE
   Useful for future WebSocket/SSE integration.
========================================================= */

export function getSuperAdminTelemetry() {
  return {
    requests: requestLogs,
    errors: errorLogs,
    stats: serviceStats,
    maintenance:
      maintenanceState,
  };
}