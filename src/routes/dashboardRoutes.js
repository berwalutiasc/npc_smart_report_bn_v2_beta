import express from "express";
import {
    getStudentDashboardData,
    getProfileUser,
    getThat,
    getProfileAdmin
} from "../controllers/dashboardController.js";
import { authenticateUser } from "../middlewares/authenticateUser.js";

const router = express.Router();

// Dashboard and profile routes
router.get("/", authenticateUser ,(req, res) => {
    console.log(
        "sdad"
    )
})
// Get student dashboard data (requires authentication)
router.get("/mydash", authenticateUser, getStudentDashboardData);

// Get user profile data (requires authentication)
router.get("/getProfile", authenticateUser, getProfileUser);

// Get user profile data (requires authentication)
router.get("/getProfileAdmin", authenticateUser, getProfileAdmin);

// Test endpoint (no authentication required)
router.get("/maserati", getThat);

export default router;