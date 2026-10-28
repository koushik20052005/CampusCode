/* =========================================================
   Quiz controller — v1 (Nov 1 quiz)
   A quiz is a hackathons row with event_type = 'quiz'. It
   reuses the hackathon approval pipeline (submit → admin
   approve → publish → OPEN) and participant registration.

   Rules, frozen for v1:
   - Solo, single attempt. One quiz_attempts row per (event, user).
   - MCQ single-correct + True/False only (both auto-scorable).
   - Correct answers NEVER leave the server until after submit.
   - Questions editable only while the event is NOT published.
   - Score: +marks per correct, -negative_marks per wrong
     (settings.negative_marks, default 0), total floored at 0.
   - Timer is server-anchored: started_at + duration. An
     expired in-progress attempt is auto-scored on next read.
========================================================= */

import pool from "../config/db.js";

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

async function getEvent(id) {
  const result = await pool.query(
    `SELECT id, title, organizer_id, event_type, settings, status,
            publication_status, start_date, end_date
       FROM hackathons WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

function quizSettings(event) {
  const raw = event?.settings && typeof event.settings === "object"
    ? event.settings
    : {};
  const duration = Number(raw.duration_minutes);
  const negative = Number(raw.negative_marks);
  const cap = Number(raw.max_participants);
  return {
    durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 30,
    negativeMarks: Number.isFinite(negative) && negative >= 0 ? negative : 0,
    maxParticipants: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : null,
  };
}

async function isRegistered(eventId, userId) {
  const result = await pool.query(
    `SELECT id FROM hackathon_participants
      WHERE hackathon_id = $1 AND user_id = $2`,
    [eventId, userId]
  );
  return result.rows.length > 0;
}

function canManageQuiz(req, event) {
  return (
    event.organizer_id === req.user.id || req.user.role === "ADMIN"
  );
}

export function validateQuestion(body) {
  const text = String(body?.question_text || "").trim();
  const type = String(body?.question_type || "MCQ").toUpperCase();
  const marks = body?.marks === undefined ? 1 : Number(body?.marks);
  if (!text) return { error: "Question text is required" };
  if (!["MCQ", "TRUE_FALSE"].includes(type)) {
    return { error: "Question type must be MCQ or TRUE_FALSE" };
  }
  if (!Number.isFinite(marks) || marks < 1) {
    return { error: "Marks must be at least 1" };
  }
  let options;
  let correctIndex;
  if (type === "TRUE_FALSE") {
    options = ["True", "False"];
    correctIndex = Number(body?.correct_index);
    if (correctIndex !== 0 && correctIndex !== 1) {
      return { error: "True/False questions need correct_index 0 or 1" };
    }
  } else {
    if (!Array.isArray(body?.options)) {
      return { error: "MCQ questions need an options array" };
    }
    options = body.options.map((o) => String(o ?? "").trim());
    if (options.length < 2 || options.length > 6 || options.some((o) => !o)) {
      return { error: "MCQ questions need 2-6 non-empty options" };
    }
    correctIndex = Number(body?.correct_index);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { error: "correct_index is out of range for the options" };
    }
  }
  return { text, type, options, correctIndex, marks: Math.floor(marks) };
}

function publicQuestion(row) {
  return {
    id: row.id,
    question_text: row.question_text,
    question_type: row.question_type,
    options: row.options,
    marks: row.marks,
    sort_order: row.sort_order,
  };
}

async function loadQuestions(eventId, includeAnswers) {
  const result = await pool.query(
    `SELECT id, question_text, question_type, options, correct_index,
            marks, sort_order
       FROM quiz_questions
      WHERE hackathon_id = $1
      ORDER BY sort_order ASC, id ASC`,
    [eventId]
  );
  return includeAnswers
    ? result.rows
    : result.rows.map(publicQuestion);
}

export function scoreAttempt(questions, answers, negativeMarks) {
  let score = 0;
  let total = 0;
  let correct = 0;
  const detail = questions.map((q) => {
    total += Number(q.marks);
    const selected = answers?.[q.id];
    const selectedIndex = selected === undefined || selected === null ? null : Number(selected);
    const isCorrect = selectedIndex === Number(q.correct_index);
    if (isCorrect) {
      score += Number(q.marks);
      correct += 1;
    } else if (selectedIndex !== null) {
      score -= negativeMarks;
    }
    return {
      question_id: q.id,
      selected_index: selectedIndex,
      correct_index: Number(q.correct_index),
      is_correct: isCorrect,
      marks: Number(q.marks),
    };
  });
  if (score < 0) score = 0;
  return { score, total, correct, detail };
}

async function submitAttemptRow(client, attempt, event) {
  const questions = await loadQuestions(event.id, true);
  const settings = quizSettings(event);
  const answers = attempt.answers && typeof attempt.answers === "object" ? attempt.answers : {};
  const { score, total, correct, detail } = scoreAttempt(questions, answers, settings.negativeMarks);
  const updated = await client.query(
    `UPDATE quiz_attempts
        SET status = 'SUBMITTED', submitted_at = NOW(),
            score = $2, total_marks = $3, correct_count = $4,
            question_count = $5
      WHERE id = $1
      RETURNING *`,
    [attempt.id, score, total, correct, questions.length]
  );
  return { attempt: updated.rows[0], detail, questions };
}

/* ---------------- organizer: questions ---------------- */

export async function listQuestions(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    if (!canManageQuiz(req, event)) return fail(res, 403, "Not your event");
    const questions = await loadQuestions(event.id, true);
    return res.json({ success: true, questions, count: questions.length });
  } catch (error) {
    console.error("QUIZ LIST QUESTIONS ERROR:", error);
    return fail(res, 500, "Unable to load questions");
  }
}

export async function createQuestion(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    if (!canManageQuiz(req, event)) return fail(res, 403, "Not your event");
    if (event.publication_status === "PUBLISHED") {
      return fail(res, 400, "Questions are locked once the quiz is published");
    }
    const valid = validateQuestion(req.body);
    if (valid.error) return fail(res, 400, valid.error);
    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
         FROM quiz_questions WHERE hackathon_id = $1`,
      [event.id]
    );
    const result = await pool.query(
      `INSERT INTO quiz_questions
         (hackathon_id, question_text, question_type, options, correct_index, marks, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING *`,
      [
        event.id,
        valid.text,
        valid.type,
        JSON.stringify(valid.options),
        valid.correctIndex,
        valid.marks,
        orderResult.rows[0].next_order,
      ]
    );
    return res.status(201).json({ success: true, question: result.rows[0] });
  } catch (error) {
    console.error("QUIZ CREATE QUESTION ERROR:", error);
    return fail(res, 500, "Unable to create question");
  }
}

export async function updateQuestion(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    if (!canManageQuiz(req, event)) return fail(res, 403, "Not your event");
    if (event.publication_status === "PUBLISHED") {
      return fail(res, 400, "Questions are locked once the quiz is published");
    }
    const valid = validateQuestion(req.body);
    if (valid.error) return fail(res, 400, valid.error);
    const result = await pool.query(
      `UPDATE quiz_questions
          SET question_text = $2, question_type = $3, options = $4::jsonb,
              correct_index = $5, marks = $6, updated_at = NOW()
        WHERE id = $1 AND hackathon_id = $7
        RETURNING *`,
      [
        req.params.questionId,
        valid.text,
        valid.type,
        JSON.stringify(valid.options),
        valid.correctIndex,
        valid.marks,
        event.id,
      ]
    );
    if (result.rows.length === 0) return fail(res, 404, "Question not found");
    return res.json({ success: true, question: result.rows[0] });
  } catch (error) {
    console.error("QUIZ UPDATE QUESTION ERROR:", error);
    return fail(res, 500, "Unable to update question");
  }
}

export async function deleteQuestion(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    if (!canManageQuiz(req, event)) return fail(res, 403, "Not your event");
    if (event.publication_status === "PUBLISHED") {
      return fail(res, 400, "Questions are locked once the quiz is published");
    }
    const result = await pool.query(
      `DELETE FROM quiz_questions WHERE id = $1 AND hackathon_id = $2`,
      [req.params.questionId, event.id]
    );
    if (result.rowCount === 0) return fail(res, 404, "Question not found");
    return res.json({ success: true, message: "Question deleted" });
  } catch (error) {
    console.error("QUIZ DELETE QUESTION ERROR:", error);
    return fail(res, 500, "Unable to delete question");
  }
}

/* ---------------- student: attempts ---------------- */

function windowError(event) {
  const now = new Date();
  if (event.start_date && now < new Date(event.start_date)) {
    return "The quiz has not started yet";
  }
  if (event.end_date && now > new Date(event.end_date)) {
    return "The quiz window has ended";
  }
  return null;
}

function attemptTiming(attempt, durationMinutes, event) {
  const started = new Date(attempt.started_at).getTime();
  let expiresAt = started + durationMinutes * 60 * 1000;
  // v6.19 — proctored quiz: the attempt also ends at the event
  // window end, so a 6:55 PM start never runs past a 7 PM close.
  if (event?.end_date) {
    const windowEnd = new Date(event.end_date).getTime();
    if (Number.isFinite(windowEnd)) expiresAt = Math.min(expiresAt, windowEnd);
  }
  return { expiresAt, remainingSeconds: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) };
}

export async function startAttempt(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    if (!(await isRegistered(event.id, req.user.id))) {
      return fail(res, 403, "Register for the quiz first");
    }
    if (event.publication_status !== "PUBLISHED" || !["OPEN", "LIVE"].includes(event.status)) {
      return fail(res, 400, "The quiz is not open yet");
    }
    const winError = windowError(event);
    if (winError) return fail(res, 400, winError);
    // v6.19 — proctored quiz: the student must accept the test
    // rules (camera/mic presence check, fullscreen) before start.
    if (req.body?.terms_accepted !== true) {
      return fail(res, 400, "Accept the quiz rules to start");
    }
    const existing = await pool.query(
      `SELECT * FROM quiz_attempts WHERE hackathon_id = $1 AND user_id = $2`,
      [event.id, req.user.id]
    );
    if (existing.rows.length > 0) {
      return fail(res, 409, "You already have an attempt for this quiz");
    }
    const questions = await loadQuestions(event.id, false);
    if (questions.length === 0) {
      return fail(res, 400, "No questions have been added to this quiz yet");
    }
    const settings = quizSettings(event);
    const attempt = await pool.query(
      `INSERT INTO quiz_attempts (hackathon_id, user_id, question_count, terms_accepted_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [event.id, req.user.id, questions.length]
    );
    const timing = attemptTiming(attempt.rows[0], settings.durationMinutes, event);
    return res.status(201).json({
      success: true,
      attempt: attempt.rows[0],
      questions,
      duration_minutes: settings.durationMinutes,
      expires_at: new Date(timing.expiresAt).toISOString(),
      remaining_seconds: timing.remainingSeconds,
    });
  } catch (error) {
    console.error("QUIZ START ATTEMPT ERROR:", error);
    return fail(res, 500, "Unable to start the quiz");
  }
}

export async function saveAnswers(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    const attempt = await pool.query(
      `SELECT * FROM quiz_attempts WHERE id = $1 AND hackathon_id = $2 AND user_id = $3`,
      [req.params.attemptId, event.id, req.user.id]
    );
    if (attempt.rows.length === 0) return fail(res, 404, "Attempt not found");
    if (attempt.rows[0].status !== "IN_PROGRESS") {
      return fail(res, 400, "This attempt is already submitted");
    }
    const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
    const result = await pool.query(
      `UPDATE quiz_attempts SET answers = $2::jsonb WHERE id = $1 RETURNING *`,
      [attempt.rows[0].id, JSON.stringify(answers)]
    );
    return res.json({ success: true, attempt: result.rows[0] });
  } catch (error) {
    console.error("QUIZ SAVE ANSWERS ERROR:", error);
    return fail(res, 500, "Unable to save answers");
  }
}

export async function getMyAttempt(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    if (!(await isRegistered(event.id, req.user.id))) {
      return fail(res, 403, "Register for the quiz first");
    }
    const settings = quizSettings(event);
    const questions = await loadQuestions(event.id, false);
    const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
    const meta = {
      event_id: event.id,
      title: event.title,
      status: event.status,
      publication_status: event.publication_status,
      start_date: event.start_date,
      end_date: event.end_date,
      duration_minutes: settings.durationMinutes,
      negative_marks: settings.negativeMarks,
      max_participants: settings.maxParticipants,
      question_count: questions.length,
      total_marks: totalMarks,
    };
    const attemptResult = await pool.query(
      `SELECT * FROM quiz_attempts WHERE hackathon_id = $1 AND user_id = $2`,
      [event.id, req.user.id]
    );
    if (attemptResult.rows.length === 0) {
      return res.json({ success: true, meta, attempt: null });
    }
    const attempt = attemptResult.rows[0];
    if (attempt.status === "SUBMITTED") {
      const full = await loadQuestions(event.id, true);
      const { detail } = scoreAttempt(full, attempt.answers, settings.negativeMarks);
      return res.json({
        success: true,
        meta,
        attempt,
        detail,
        questions: full.map((q) => ({ ...publicQuestion(q), correct_index: Number(q.correct_index) })),
      });
    }
    // In progress: expire server-side if the timer ran out.
    const timing = attemptTiming(attempt, settings.durationMinutes, event);
    if (timing.remainingSeconds <= 0) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query(
          `SELECT * FROM quiz_attempts WHERE id = $1 FOR UPDATE`,
          [attempt.id]
        );
        if (locked.rows[0].status === "IN_PROGRESS") {
          const scored = await submitAttemptRow(client, locked.rows[0], event);
          await client.query("COMMIT");
          return res.json({ success: true, meta, attempt: scored.attempt, detail: scored.detail, questions: scored.questions.map((q) => ({ ...publicQuestion(q), correct_index: Number(q.correct_index) })) });
        }
        await client.query("ROLLBACK");
        const full = await loadQuestions(event.id, true);
        const { detail } = scoreAttempt(full, locked.rows[0].answers, settings.negativeMarks);
        return res.json({
          success: true,
          meta,
          attempt: locked.rows[0],
          detail,
          questions: full.map((q) => ({ ...publicQuestion(q), correct_index: Number(q.correct_index) })),
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    return res.json({
      success: true,
      meta,
      attempt,
      questions,
      remaining_seconds: timing.remainingSeconds,
      expires_at: new Date(timing.expiresAt).toISOString(),
    });
  } catch (error) {
    console.error("QUIZ GET ATTEMPT ERROR:", error);
    return fail(res, 500, "Unable to load your attempt");
  }
}

/* v6.19 — proctored quiz: fullscreen-exit / tab-switch flags.
   Counts only — no video, no audio, nothing recorded. The
   client tracks the counts and reports them best-effort. */
export async function reportProctor(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    const attempt = await pool.query(
      `SELECT * FROM quiz_attempts WHERE id = $1 AND hackathon_id = $2 AND user_id = $3`,
      [req.params.attemptId, event.id, req.user.id]
    );
    if (attempt.rows.length === 0) return fail(res, 404, "Attempt not found");
    if (attempt.rows[0].status !== "IN_PROGRESS") {
      return res.json({ success: true, attempt: attempt.rows[0] });
    }
    const fsExits = Math.max(0, Math.floor(Number(req.body?.fullscreen_exits) || 0));
    const tabSwitches = Math.max(0, Math.floor(Number(req.body?.tab_switches) || 0));
    const result = await pool.query(
      `UPDATE quiz_attempts SET fullscreen_exits = $2, tab_switches = $3 WHERE id = $1 RETURNING *`,
      [attempt.rows[0].id, fsExits, tabSwitches]
    );
    return res.json({ success: true, attempt: result.rows[0] });
  } catch (error) {
    console.error("QUIZ PROCTOR ERROR:", error);
    return fail(res, 500, "Unable to save proctor flags");
  }
}

export async function submitAttempt(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    const attemptResult = await pool.query(
      `SELECT * FROM quiz_attempts WHERE id = $1 AND hackathon_id = $2 AND user_id = $3`,
      [req.params.attemptId, event.id, req.user.id]
    );
    if (attemptResult.rows.length === 0) return fail(res, 404, "Attempt not found");
    const attempt = attemptResult.rows[0];
    if (attempt.status === "SUBMITTED") {
      return fail(res, 400, "This attempt is already submitted");
    }
    const incoming = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT * FROM quiz_attempts WHERE id = $1 FOR UPDATE`,
        [attempt.id]
      );
      if (locked.rows[0].status === "SUBMITTED") {
        await client.query("ROLLBACK");
        return fail(res, 400, "This attempt is already submitted");
      }
      if (incoming) {
        await client.query(
          `UPDATE quiz_attempts SET answers = $2::jsonb WHERE id = $1`,
          [attempt.id, JSON.stringify(incoming)]
        );
        locked.rows[0].answers = incoming;
      }
      const scored = await submitAttemptRow(client, locked.rows[0], event);
      await client.query("COMMIT");
      return res.json({
        success: true,
        attempt: scored.attempt,
        detail: scored.detail,
        questions: scored.questions.map((q) => ({ ...publicQuestion(q), correct_index: Number(q.correct_index) })),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("QUIZ SUBMIT ATTEMPT ERROR:", error);
    return fail(res, 500, "Unable to submit the quiz");
  }
}

export async function getLeaderboard(req, res) {
  try {
    const event = await getEvent(req.params.id);
    if (!event) return fail(res, 404, "Event not found");
    if (event.event_type !== "quiz") return fail(res, 400, "Event is not a quiz");
    const allowed =
      req.user.role === "ADMIN" ||
      event.organizer_id === req.user.id ||
      (await isRegistered(event.id, req.user.id));
    if (!allowed) return fail(res, 403, "Register for the quiz first");
    const result = await pool.query(
      `SELECT a.user_id, a.score, a.total_marks, a.correct_count,
              a.question_count, a.submitted_at,
              u.name AS user_name
         FROM quiz_attempts a
         JOIN users u ON u.id = a.user_id
        WHERE a.hackathon_id = $1 AND a.status = 'SUBMITTED'
        ORDER BY a.score DESC, a.submitted_at ASC NULLS LAST
        LIMIT 100`,
      [event.id]
    );
    return res.json({ success: true, leaderboard: result.rows });
  } catch (error) {
    console.error("QUIZ LEADERBOARD ERROR:", error);
    return fail(res, 500, "Unable to load the leaderboard");
  }
}
