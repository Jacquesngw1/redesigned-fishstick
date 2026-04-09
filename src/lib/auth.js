/**
 * Neuralis Black — GEO Audit SaaS Platform
 * lib/auth.js
 *
 * Authentication helpers: JWT sign/verify and password hashing.
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

/**
 * Sign a JWT token for a user.
 * @param {object} payload - Data to encode (e.g. { userId, email, role })
 * @returns {string} Signed JWT
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {object} Decoded payload
 * @throws {Error} If the token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Hash a plain-text password.
 * @param {string} password
 * @returns {Promise<string>} Bcrypt hash
 */
async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain-text password against a stored hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Extract and verify the Bearer token from a Next.js request.
 * @param {Request} request - Next.js App Router Request object
 * @returns {object} Decoded JWT payload
 * @throws {Error} If no token present or token is invalid
 */
function getAuthUser(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  try {
    return verifyToken(token);
  } catch {
    throw new Error("Unauthorized: Invalid or expired token");
  }
}

/**
 * Middleware-style helper: returns the auth user or null (no throw).
 * @param {Request} request
 * @returns {object|null}
 */
function getAuthUserOrNull(request) {
  try {
    return getAuthUser(request);
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
  getAuthUser,
  getAuthUserOrNull,
};
