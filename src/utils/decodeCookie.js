import jwt from "jsonwebtoken";

export const decodeCookie = (req) => {
  try {
    // Automatically fetch the cookie named "tokenUser"
    const token = req.cookies.tokenUser; 
    if (!token) return null;

    // Decode and verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error("decodeCookie error:", error);
    return null;
  }
};
