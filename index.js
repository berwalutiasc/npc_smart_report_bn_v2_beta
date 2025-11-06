import express from "express";
import dotenv from "dotenv";
import authRoutes from "./src/routes/authRoutes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import socketServices from "./src/services/socketServices.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import itemRoutes from "./src/routes/itemRoutes.js";
import classRoutes from "./src/routes/classRoutes.js";
import adminDashboardRoute from "./src/routes/adminDashboardRoutes.js"

// Server creation imports
import { createServer } from "http";
import { Server } from "socket.io";

// Load environment variables
dotenv.config();

// Initialize Express application
const app = express();
// Trust first proxy (Render/Heroku/NGINX) so secure cookies work
app.set("trust proxy", 1);

// Create HTTP server with Express app
const httpServer = createServer(app);

// Configure Socket.IO with CORS settings
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize socket services with the IO instance
socketServices.setIO(io);

// Socket.IO connection event handlers
io.on("connection", (socket) => {
    // User connected - socket ID available if needed for future features
    
    socket.on("disconnect", () => {
        // User disconnected - socket ID available if needed for future features
    });
});

// Make IO instance available throughout the app
app.set("io", io);

// CORS configuration - MUST be early to handle preflight requests and cookies
const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:3000",
].filter(Boolean); // Remove any undefined values

// ✅ FIXED: Proper CORS middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, postman, curl)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // For development, you might want to be more permissive
        if (process.env.NODE_ENV === 'development') {
            console.log('Allowing origin in development:', origin);
            return callback(null, true);
        }
        
        console.log('CORS blocked for origin:', origin);
        return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Cookie"],
    exposedHeaders: ["Set-Cookie"]
}));

// ✅ FIXED: Proper preflight handler - remove the problematic line
// app.options("*", cors()); // ❌ This was causing the error

// Instead, let the CORS middleware handle preflight automatically
// Or be more specific if needed:
app.options("/api/*", (req, res) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Credentials", "true");
    res.sendStatus(200);
});

// Middleware setup
app.use(cookieParser());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Debug route to check CORS and cookies
app.get("/debug-cors", (req, res) => {
    res.json({
        origin: req.headers.origin,
        cookies: req.cookies,
        cookieHeader: req.headers.cookie,
        'user-agent': req.headers['user-agent'],
        method: req.method
    });
});

// Route handlers
app.use("/api/auth", authRoutes);           // Authentication routes (login, register, password reset)
app.use("/api/student/dashboard", dashboardRoutes);  // Student dashboard routes
app.use("/api/student/report", reportRoutes);        // Student report routes
app.use("/api/item", itemRoutes);           // Item management routes
app.use("/api/class", classRoutes);         // Class management routes
app.use("/api/admin/dashboard", adminDashboardRoute);

// 404 handler for API routes
app.use("/api/*", (req, res) => {
    res.status(404).json({ 
        message: "API endpoint not found",
        path: req.originalUrl 
    });
});

// Catch-all handler for SPA (if serving frontend)
app.get("*", (req, res) => {
    res.status(404).json({ 
        message: "Route not found",
        path: req.originalUrl 
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    if (error.message.includes('CORS')) {
        return res.status(403).json({ 
            message: 'CORS error',
            details: error.message 
        });
    }
    
    res.status(500).json({ 
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// Server configuration
const port = process.env.PORT || 5000;

// Start the server
httpServer.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Client URL: ${process.env.CLIENT_URL}`);
    console.log(`📡 Health check: http://localhost:${port}/health`);
});

// Export IO instance for use in other modules
export { io };