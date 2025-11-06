import { PrismaClient } from "@prisma/client";
import { hashThePassword } from "../utils/hashPassword.js";
import { generateLink } from "../utils/generateLink.js";
import { compareThePassword } from "../utils/compareThePassword.js";
import { generateUsername } from "../utils/generateUsername.js";
import { emailService } from "../services/resendMailer.js";
import { generateUserId } from "../utils/generateUserId.js";
import { generateOtp } from "../utils/generateOtp.js";
import { createToken } from "../utils/createToken.js";
import { decodeCookie } from "../utils/decodeCookie.js";
import socketServices from "../services/socketServices.js";

const prisma = new PrismaClient();

/**
 * Create a new student account
 * Handles student registration with email verification
 */
export const createStudent = async (req, res) => {
  try {
    const { 
      name,
      email,
      phone,
      password,
      rank,
      address,
      classId,       // optional class association
    } = req.body;

    // Enhanced validation
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password?.trim()) {
      return res.status(400).json({ 
        error: "Name, email, phone, and password are required fields" 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email, phone, or username already exists
    const username = generateUsername(name);
    
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.trim().toLowerCase() },
          { phone: phone.trim() },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email.trim().toLowerCase()) {
        return res.status(400).json({ error: "Email already registered" });
      }
      if (existingUser.phone === phone.trim()) {
        return res.status(400).json({ error: "Phone number already registered" });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    // Validate class exists if provided
    if (classId) {
      const existingClass = await prisma.class.findUnique({
        where: { id: classId }
      });
      
      if (!existingClass) {
        return res.status(400).json({ error: "Invalid class ID provided" });
      }
    }

    // Hash password
    const hashedPassword = await hashThePassword(password);
    const link = generateLink(username);

    // Create the user with student profile
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        username,
        password: hashedPassword,
        rank: rank?.trim() || null,
        address: address?.trim() || null,
        role: "STUDENT", // Fixed: Hardcoded as STUDENT, 
        status: "ACTIVE",
        // Create student profile (no studentRole field anymore)
        studentProfile: {
          create: {
            ...(classId && { 
              class: { connect: { id: classId } } 
            })
          }
        },

        // Email verification
        verifications: {
          create: {
            reason: "EMAIL_VERIFICATION",
            link,
            code: "",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          }
        }
      },
      include: {
        studentProfile: { 
          include: { 
            class: true 
          } 
        },
        verifications: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    const verificationUrl = `https://npc-smart-report-fn-v2-beta-bozj.vercel.app/auth/verify/email?token=${link}`;

    // Send verification email using resendMailer
    try {
      await emailService.sendVerificationEmail(email, name, verificationUrl);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Continue execution even if email fails - user is still created
    }

    return res.status(201).json({
      message: "Student created successfully. Verification email sent.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        status: user.status,
        role: user.role,
        studentProfile: user.studentProfile ? {
          id: user.studentProfile.id,
          class: user.studentProfile.class
        } : null
      }
    });

  } catch (error) {
    console.error("Error creating student:", error);
    
    // Handle Prisma specific errors
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: "Unique constraint violation - user already exists" 
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(400).json({ 
        error: "Related record not found" 
      });
    }

    return res.status(500).json({ 
      error: "Internal Server Error",
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * Create a new student account
 * Handles student registration with email verification
 */
export const createAdmin = async (req, res) => {
    try {
        const { 
            name,
            email,
            phone,
            password,
            rank,
            address,
            role,
            department
        } = req.body;

        // Input validation and sanitation
        if (!name?.trim() || !email?.trim() || !phone?.trim() || !password?.trim()) {
            return res.status(400).json({ error: "Required fields missing" });
        }

        // Check for existing user using indexed fields
        const existingEmailPhone = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email.trim() },  // Uses @@index([email, status])
                    { phone: phone.trim() }   // Phone is @unique (automatically indexed)
                ]
            }
        });

        if (existingEmailPhone) {
            return res.status(400).json({ error: "Email or Phone already used" });
        }

        // Hash password and generate user data
        const hashedPassword = hashThePassword(password);
        const username = generateUsername(name);
        let link = generateLink(username);
        let permissions = [
            "READ_USER",
            "READ_REPORT",
            "REVIEW_REPORT",
        ];

        if(department){
            if(department === "SYSTEM_ADMIN"){
                permissions.push(
                    "CREATE_USER",
                    "UPDATE_USER",
                    "DELETE_USER",
                    "CREATE_REPORT",
                    "UPDATE_REPORT",
                    "DELETE_REPORT",
                    "CREATE_CLASS",
                    "UPDATE_CLASS",
                    "DELETE_CLASS",
                    "CREATE_ITEM",
                    "UPDATE_ITEM",
                    "DELETE_ITEM"
                );
            }
        }

        // Create user with student profile AND verification in one operation
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                username,
                password: hashedPassword,
                rank: rank?.toUpperCase() || "",
                address: address?.trim() || "",
                role: role || "ADMIN",
                adminProfile: {
                    create: {
                        department: department || null,
                        permissions: permissions || []
                    }
                },
                verifications: {
                    create: {
                        reason: "EMAIL_VERIFICATION",
                        link: link,
                        code: "",
                    }
                }
            },
            include: {
                adminProfile: true,
                verifications: true
            }
        });

        // Generate verification link using BASE_URL
        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/verify/email?token=${link}`;
        
        // Send verification email using resendMailer
        try {
          await emailService.sendVerificationEmail(email, name, verificationUrl);
        } catch (error) {
          console.error('Failed to send verification email:', error);
          // Continue execution even if email fails - user is still created
        }

        // Emit socket event for user registration
        const io = req.app.get("io");
        socketServices.emitUserRegistered(user);

        return res.status(201).json({
            message: "Student created successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                studentProfile: user.studentProfile
            }
        });

    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * User login with OTP verification
 * Handles authentication and sends OTP for verification
 */
export const loginUser = async (req, res) => {
    try {
        const {
            email,
            password,
            rememberMe
        } = req.body;

        // Input validation
        if (!email?.trim() || !password?.trim()) {
            return res.status(400).json({ error: "Required fields missing" });
        }

        // Check if user exists using indexed email field
        const user = await prisma.user.findFirst({
            where: {
                email: email.trim(),
                status: "ACTIVE" // Uses @@index([email, status])
            },
            include: {
                studentProfile: true
            }
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid credentials double check and try again" });
        }

        // Check if user is activated
        if (user.status !== "ACTIVE") {
            return res.status(400).json({ error: "User is not activated please check your email to activate your account" });
        }

        // Verify password
        const isPasswordTrue = compareThePassword(password, user.password);
        if (!isPasswordTrue) {
            return res.status(400).json({ error: "Invalid credentials double check and try again" });
        }

        // Generate and send OTP
        const otp = generateOtp();

        // Save OTP using indexed userId field
        await prisma.verification.upsert({
            where: {
                userId: user.id,
            },
            update: {
                code: otp,
                link: ""
            },
            create: {
                userId: user.id,
                reason: "LOGIN_VERIFICATION",
                code: otp,
                link: ""
            }
        });

        // Send OTP email using resendMailer
        try {
            await emailService.sendOTP(email, otp);
        } catch (error) {
            console.error('Failed to send OTP email:', error);
            // Continue execution - user can still verify OTP if they have it from another source
            // In production, you might want to return an error here
        }

        // Create temporary token for OTP verification
        const token = createToken({
            userId: user.id,
            name: user.name,
            userEmail: user.email,
            userRole: user.role,
        });

        // Set temporary cookie for OTP verification
        const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax", // "none" required for cross-origin with secure cookies
            path: "/",
            expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        };

        // Extend cookie duration if remember me is selected
        if (rememberMe) {
            cookieOptions.expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        }

        // Set cookie
        res.cookie("tokenUser", token, cookieOptions);
        
        // Debug logging for cookie setting
        console.log("loginUser: Setting cookie with options:", {
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            path: cookieOptions.path,
            isProduction,
            cookieSet: true
        });
        console.log("loginUser: Token length:", token?.length || 0);

        return res.status(200).json({   
            message: "Login successful. Store the 'token' field and send it in verifyLoginOtp request.",
            token, // CRITICAL: Frontend MUST send this token in verifyLoginOtp
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            // Instructions for frontend
            nextStep: "Send this token in verifyLoginOtp as: Authorization header 'Bearer <token>' OR in body as { otp: '...', token: '<token>' }"
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Verify login OTP for user authentication
 * Completes the login process after OTP verification
 */
export const verifyLoginOtpUser = async (req, res) => {
    try {
        const { otp, token } = req.body;

        // Debug logging for incoming request
        console.log("verifyLoginOtpUser: Request received");
        console.log("  - Cookies:", Object.keys(req.cookies || {}));
        console.log("  - Auth header:", req.headers?.authorization ? "present" : "missing");
        console.log("  - Body keys:", Object.keys(req.body || {}));
        console.log("  - Body has token:", !!req.body?.token);
        console.log("  - OTP provided:", !!otp);

        // Get user info from decoded token (tries cookies, Authorization header, or body.token)
        const decodedToken = decodeCookie(req);
        if (!decodedToken) {
            console.error("verifyLoginOtpUser: Failed to decode token.");
            console.error("  - All cookies:", req.cookies);
            console.error("  - Authorization header value:", req.headers?.authorization?.substring(0, 20) + "..." || "none");
            console.error("  - Full request body:", JSON.stringify(req.body));
            
            return res.status(400).json({ 
                message: "Invalid token. Please ensure you're sending the token from loginUser response.",
                hint: "Send token in Authorization header as 'Bearer <token>' or in request body as 'token' field",
                received: {
                    cookies: Object.keys(req.cookies || {}),
                    hasAuthHeader: !!req.headers?.authorization,
                    bodyKeys: Object.keys(req.body || {})
                }
            });
        }

        const userId = decodedToken.userId;
        if (!userId || !otp) {
            return res.status(400).json({ message: "Required fields missing" });
        }

        // Check verification using indexed userId field
        const verification = await prisma.verification.findFirst({
            where: {
                userId: userId,
                reason: "LOGIN_VERIFICATION"
            }
        });

        if (!verification) {
            return res.status(400).json({ message: "Invalid token" });
        }

        if (verification.code !== otp) {
            return res.status(400).json({ message: "Invalid otp" });
        }


        // Create final login token
        const loginToken = createToken({
            userId: decodedToken.userId,
            name: decodedToken.name,
            userEmail: decodedToken.userEmail,
            userRole: decodedToken.userRole,
        });
        console.log("done")
        // Set final login cookie
        const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
        const loginTokenOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax", // "none" required for cross-origin with secure cookies
            path: "/",
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        };

        res.cookie("loginToken", loginToken, loginTokenOptions);

        // Clear temporary OTP verification cookie
        res.clearCookie("tokenUser", {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/"
        });

        // Delete verification record after successful verification
        await prisma.verification.deleteMany({
            where: {
                userId: userId,
                reason: "LOGIN_VERIFICATION"
            }
        });

        console.log("almost")

        // Send login notification email using resendMailer
        try {
            await emailService.sendLoginNotification(decodedToken.userEmail, "SMART_WIFI", new Date().toLocaleString());
        } catch (error) {
            console.error('Failed to send login notification email:', error);
            // Continue execution - login is successful even if notification email fails
        }

        return res.status(200).json({
            message: "Login successful",
            loginToken,
            role: decodedToken.userRole,
            user: {
                id: decodedToken.userId,
                name: decodedToken.name,
                email: decodedToken.userEmail,
                role: decodedToken.userRole,
            }
        });

    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

/**
 * Verify student signup link for email verification
 * Activates user account after email verification
 */
export const verifySignupLinkUser = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: "Token is required" });
        }

        // Extract userId from token
        const userId = generateUserId(token);
        
        if (!userId || userId.length !== 6) {
            return res.status(400).json({ error: "Invalid userId" });
        }

        // Check user using indexed username field
        const user = await prisma.user.findFirst({
            where: {
                username: userId,
                status: "PENDING" // Uses index for better performance
            },
            include: {
                verifications: true
            }
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid token" });
        }

        // Find verification record using indexed userId
        const findVerification = await prisma.verification.findFirst({
            where: {
                userId: user.id,
                reason: "EMAIL_VERIFICATION"
            }
        });

        if (!findVerification) {
            return res.status(400).json({ error: "Invalid token" });
        }

        // Activate user account
        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                status: "ACTIVE"
            }
        });

        // Delete verification record after successful activation
        await prisma.verification.delete({
            where: {
                id: findVerification.id
            }
        });

        return res.status(200).json({
            message: "Email verification successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                studentRole: user.studentProfile?.studentRole || null
            }
        });
        
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Log out the student by clearing authentication cookies
 */
export const logoutStudent = (req, res) => {
    try {
        res.clearCookie("loginToken");
        return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};