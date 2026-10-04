/* =========================================================
   PAGINATION HELPER
   Usage:
     const { page, limit, offset } = getPagination(req);
     ... LIMIT $x OFFSET $y ...
     return res.json({ ..., pagination: buildPaginationMeta(page, limit, total) });
========================================================= */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function getPagination(req, defaultLimit = DEFAULT_LIMIT) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(limit, MAX_LIMIT);

  return { page, limit, offset: (page - 1) * limit };
}

export function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}
