export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'You need to sign in to do that.') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Your account does not have access to that.') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, message);
  }
  static conflict(message, details) {
    return new ApiError(409, message, details);
  }
}

// Express 5 forwards rejected promises automatically, but wrapping keeps the
// intent explicit and stays correct if the app is ever downgraded to Express 4.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.originalUrl}` } });
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err);

  res.status(status).json({
    error: {
      message: status >= 500 ? 'Something went wrong on our side.' : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
};
