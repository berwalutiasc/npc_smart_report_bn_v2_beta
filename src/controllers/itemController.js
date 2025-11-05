import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Create a new item
 * Handles item creation with name and description
 */
export const createItem = async (req, res) => {
    try {
        const {
            name,
            description,
        } = req.body;

        // Validate required fields
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Create new item in database
        const item = await prisma.item.create({
            data: {
                name,
                description,
            }
        });

        return res.status(200).json({ success: true, item });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Update an existing item
 * Handles item information updates
 */
export const updateItem = async (req, res) => {
    try {
        const {
            id,
            name,
            description,
        } = req.body;

        // Validate required fields
        if (!id || !name || !description) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Update item in database
        const item = await prisma.item.update({
            where: {
                id
            },
            data: {
                name,
                description,
                updatedAt: new Date(),
            }
        });

        return res.status(200).json({ success: true, item });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Get a specific item by ID
 * Retrieves item details from database
 */
export const getItem = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate required parameter
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Find item by ID
        const item = await prisma.item.findUnique({
            where: {
                id
            }
        });

        return res.status(200).json({ success: true, item });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Delete an item by ID
 * Removes item from database
 */
export const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate required parameter
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Delete item from database
        const item = await prisma.item.delete({
            where: {
                id
            }
        });

        return res.status(200).json({ success: true, item });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Get all items
 * Retrieves all items with basic information, ordered by creation date
 */
export const getAllItem = async (req, res) => {
    try {
        // Retrieve all items with selected fields
        const items = await prisma.item.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        return res.status(200).json({ success: true, items });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};