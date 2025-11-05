import express from "express";
import {
    getAllItem,
    createItem,
    updateItem,
    getItem,
    deleteItem
} from "../controllers/itemController.js";

const router = express.Router();

// Item management routes

// Create a new item
router.post("/createItem", createItem);

// Update an existing item
router.post("/updateItem", updateItem);

// Get a specific item by ID
router.get("/getItem/:id", getItem);

// Delete an item by ID
router.delete("/deleteItem/:id", deleteItem);

// Get all items
router.get("/getAllItems", getAllItem);

export default router;