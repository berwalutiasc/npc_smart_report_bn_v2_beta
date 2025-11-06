import jwt from "jsonwebtoken";

export const decodeCookie = (req) => {
  try {
    let token = null;

    // Try to get token from multiple sources (in order of preference)
    // 1. From cookies (preferred method)
    token = req.cookies?.tokenUser;
    
    // 2. From Authorization header (Bearer token)
    if (!token && req.headers?.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // 3. From request body (fallback for OTP verification)
    if (!token && req.body?.token) {
      token = req.body.token;
    }

    // Debug logging for production issues
    if (!token) {
      console.error("decodeCookie: No token found in any source.");
      console.error("  - Cookies:", Object.keys(req.cookies || {}));
      console.error("  - Auth header:", req.headers?.authorization ? "present" : "missing");
      console.error("  - Body token:", req.body?.token ? "present" : "missing");
      return null;
    }

    // Decode and verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error("decodeCookie error:", error.message);
    if (error.name === 'JsonWebTokenError') {
      console.error("Invalid JWT token format");
    } else if (error.name === 'TokenExpiredError') {
      console.error("Token has expired");
    }
    return null;
  }
};
