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
app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"]
}));

// Middleware setup
app.use(cookieParser());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route handlers
app.use("/api/auth", authRoutes);           // Authentication routes (login, register, password reset)
app.use("/api/student/dashboard", dashboardRoutes);  // Student dashboard routes
app.use("/api/student/report", reportRoutes);        // Student report routes
app.use("/api/item", itemRoutes);           // Item management routes
app.use("/api/class", classRoutes);         // Class management routes
app.use("/api/admin/dashboard", adminDashboardRoute)

// Server configuration
const port = process.env.PORT || 5000;

// Start the server
httpServer.listen(port, () => {
    // Server successfully started
});

// Export IO instance for use in other modules
export { io };