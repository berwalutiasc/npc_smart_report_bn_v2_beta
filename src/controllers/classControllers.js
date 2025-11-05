import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Create a new class
 * Handles class creation with name and description
 */
export const createClass = async (req, res) => {
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

        // Create new class in database
        const Class = await prisma.class.create({
            data: {
                name,
                description,
            }
        });

        return res.status(200).json({ success: true, Class });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Update an existing class
 * Handles class information updates
 */
export const updateClass = async (req, res) => {
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

        // Update class in database
        const Class = await prisma.class.update({
            where: {
                id
            },
            data: {
                name,
                description,
                updatedAt: new Date(),
            }
        });

        return res.status(200).json({ success: true, Class });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Get a specific class by ID
 * Retrieves class details from database
 */
export const getClass = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate required parameter
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Find class by ID
        const Class = await prisma.class.findUnique({
            where: {
                id
            }
        });

        return res.status(200).json({ success: true, Class });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Delete a class by ID
 * Removes class from database
 */
export const deleteClass = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate required parameter
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Delete class from database
        const Class = await prisma.class.delete({       
            where: {
                id
            }
        });

        return res.status(200).json({ success: true, Class });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

/**
 * Get all classes
 * Retrieves all classes with basic information, ordered by creation date
 */
export const getAllClass = async (req, res) => {
    try {
        // Retrieve all classes with selected fields
        const Classs = await prisma.class.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        return res.status(200).json({ success: true, Classs });
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};