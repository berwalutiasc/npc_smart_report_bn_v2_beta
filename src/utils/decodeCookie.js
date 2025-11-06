import jwt from "jsonwebtoken";

export const decodeCookie = (req) => {
  try {
    // Automatically fetch the cookie named "tokenUser"
    const token = req.cookies?.tokenUser; 
    
    // Debug logging for production issues
    if (!token) {
      console.error("decodeCookie: No token found in cookies. Available cookies:", Object.keys(req.cookies || {}));
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
