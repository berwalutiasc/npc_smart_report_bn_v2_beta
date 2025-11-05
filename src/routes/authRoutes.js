import express from "express";
import {
    createAdmin,
    createStudent,
    loginUser,
    logoutStudent,
    verifyLoginOtpUser,
    verifySignupLinkUser
} from "../controllers/authController.js";

const router = express.Router();

// Student registration and authentication routes

// Create a new student account
router.post("/createStudent", createStudent);

// Create a new student account
router.post("/createAdmin", createAdmin);

// Login user with credentials
router.post("/loginUser", loginUser);

// Verify login OTP for two-factor authentication
router.post("/verifyLoginOtp", verifyLoginOtpUser);

// Verify email signup link for account activation
router.post("/verifySignupLink", verifySignupLinkUser);

// Logout user and clear authentication tokens
router.post("/logoutUser", logoutStudent);

export default router;