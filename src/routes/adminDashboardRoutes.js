import express from "express"
import { authenticateMe, authenticateUser } from "../middlewares/authenticateUser.js";
import { getAdminDashboardData, getTodayReport, getAllReports, getWeeklyReport, getOrganizedReport, getWeekReports, getRepresentatives,  getClasses, getInspectionItems, getAdminProfile } from "../controllers/adminDashboardController.js";


const router = express.Router()




router.get("/getAdminDashboardData", authenticateMe, getAdminDashboardData);
router.get("/getTodayReports", authenticateMe, getTodayReport);
router.get("/getAllReports", authenticateMe, getAllReports);
router.get("/getWeeklyReport", authenticateMe, getWeeklyReport);
router.get("/getOrganizedReports", authenticateMe, getOrganizedReport);
router.get("/getWeekReports", authenticateMe, getWeekReports);
router.get("/getRepresentatives", authenticateMe, getRepresentatives);
router.get("/getClasses", authenticateMe, getClasses);
router.get("/getItems", authenticateMe, getInspectionItems)
router.get("/getAdminProfile", authenticateUser, getAdminProfile)






export default router