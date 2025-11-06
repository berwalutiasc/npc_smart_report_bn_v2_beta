import express from "express";
import {
    saveReport,
    getReport,
    getReportById,
    downloadReport,
    getApprovalReport,
    approveReport,
    denyReport
} from "../controllers/reportController.js";
import { authenticateUser } from "../middlewares/authenticateUser.js";

const router = express.Router();

// Report management routes

// Get reports with filtering and pagination
router.get("/getReports", getReport);

// Submit a new report
router.post("/submit", saveReport);

// Get detailed report by ID
router.get("/getReportById/:id", getReportById);

// Download report as PDF
router.get("/download/:id", downloadReport);

// Get today's report for approval (CS/CP roles)
router.get('/approval', authenticateUser, getApprovalReport);

// Approve a report (CS/CP roles)
router.post('/approval/:reportId/approve', authenticateUser, approveReport);

// Deny a report (CS/CP roles)
router.post('/approval/:reportId/deny', authenticateUser, denyReport);

export default router;