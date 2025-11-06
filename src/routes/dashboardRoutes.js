import express from "express";
import {
    getStudentDashboardData,
    getProfileUser,
    getThat,
    getProfileAdmin,
    updateProfileUser
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
router.get("/mydash", getStudentDashboardData);

// Get user profile data (requires authentication)
router.get("/getProfile", getProfileUser);

// Get user profile data (requires authentication)
router.get("/getProfileAdmin", authenticateUser, getProfileAdmin);

// Test endpoint (no authentication required)
router.get("/maserati", getThat);

router.post("/updateProfile", authenticateUser, updateProfileUser);

export default router;