import express from "express";
import {
    getAllClass,
    createClass,
    updateClass,
    getClass,
    deleteClass
} from "../controllers/classControllers.js";

const router = express.Router();

// Class management routes

// Create a new class
router.post("/createClass", createClass);

// Update an existing class
router.post("/updateClass", updateClass);

// Get a specific class by ID
router.get("/getClass/:id", getClass);

// Delete a class by ID
router.delete("/deleteClass/:id", deleteClass);

// Get all classes
router.get("/getAllClass", getAllClass);

export default router;