import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware to authenticate users using JWT token
 * Verifies token validity and user status before allowing access to protected routes
 */
export const authenticateUser = async (req, res, next) => {
  try {
    // 1️⃣ Extract token from cookies
    console.log("Asd")
    const token = req.cookies.loginToken;

    if (!token) {
      console.log("No token provided")
      return res.status(401).json({ message: "Access denied. No token provided." });
    }


    console.log("here")

    // 2️⃣ Verify token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Fetch user with profile info
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
      select: {
        id: true,
        email: true,
        status: true,
        role: true,
        studentProfile: {
          select: {
            id: true,
            class: { // singular relation
              select: {
                id: true,
                name: true
              }
            },
          }
        },
        adminProfile: {
          select: {
            id: true,
            department: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ message: "User not found. Token invalid." });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        message: `Account is ${user.status.toLowerCase()}. Please contact administrator.`
      });
    }

    // 4️⃣ Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      classList: user.studentProfile?.class ? [{ 
        id: user.studentProfile.class.id, 
        name: user.studentProfile.class.name 
      }] : [], // single class converted to array
      studentRole: user.studentProfile?.studentRole || null,
      department: user.adminProfile?.department || null
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token." });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired. Please login again." });
    }
    console.error("Authentication error:", error);
    return res.status(500).json({ message: "Authentication failed. Please try again." });
  }
};





export const authenticateMe = async (req, res, next) => {
    try{
        const token = req.cookies.loginToken;
        return next()
    }catch(error){
        return res.status(500).json({
            message: "Authentication failed. Please try again."
        });
    }
}