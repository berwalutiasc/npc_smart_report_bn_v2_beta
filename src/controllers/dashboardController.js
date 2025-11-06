import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken"
const prisma = new PrismaClient();

/**
 * Test endpoint to verify API functionality
 */
export const getThat = async (req, res) => {
    try {
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
};

/**
 * Get user profile information including student details and statistics
 */
export const getProfileUser = async (req, res) => {
    try {
        // Extract email from query parameters
        // receiveing the token from the token param if the endpoint

        const token = req.params.token;
        console.log("my tok", token)
        // decode the cookie here now using jwt 

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const email = decodedToken.email;

        // Validate required parameter
        if (!email) {
            return res.status(400).json({
                success: false, 
                message: 'Email is required'
            });
        }

        // Fetch user with student profile and class information
        const user = await prisma.user.findUnique({
            where: { email: email },  
            include: {
                studentProfile: {
                    include: {
                        class: {
                            select: {
                                id: true,
                                name: true,
                                description: true
                            }
                        }
                    }
                }
            }
        });

        // Check if user exists
        if (!user) {
            return res.status(404).json({
                success: false, 
                message: 'User not found'
            });
        }

        // Verify user has student role
        if (user.role !== 'STUDENT') {
            return res.status(403).json({
                success: false, 
                message: 'Access denied. Student role required.'
            });
        }

        // Get report statistics for the user
        const reportStats = await prisma.report.count({
            where: { reporterId: user.id }
        });

        // Get approved reports count
        const approvedReports = await prisma.report.count({
            where: {
                reporterId: user.id,
                status: {
                    in: ['APPROVED', 'REVIEWED']
                }
            }
        });

        // Get pending reports count
        const pendingReports = await prisma.report.count({
            where: {
                reporterId: user.id,
                status: {
                    in: ['SUBMITTED', 'UNDER_REVIEW', 'PARTIAL']
                }
            }
        });

        // Transform data to match frontend format
        const profileData = {
            // Personal Information
            firstName: user.name.split(' ')[0] || user.name,
            lastName: user.name.split(' ').slice(1).join(' ') || '',
            email: user.email,
            phone: user.phone,
            studentId: user.username,
            class: user.studentProfile?.class?.name || 'Not assigned',
            department: user.studentProfile?.class?.description || 'General Studies',
            enrollmentDate: new Date(user.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
            }),
            address: user.address || 'Address not provided',
            dateOfBirth: user.createdAt.toISOString().split('T')[0], // Using creation date as fallback
            
            // Student role
            studentRole: user.studentProfile?.studentRole || 'WS',
            
            // Statistics for the profile card
            statistics: [
                { 
                    label: 'Reports Submitted', 
                    value: reportStats.toString(), 
                    icon: 'FileText', 
                    color: '#3b82f6' 
                },
                { 
                    label: 'Approved Reports', 
                    value: approvedReports.toString(), 
                    icon: 'CheckCircle', 
                    color: '#10b981' 
                },
                { 
                    label: 'Pending Reports', 
                    value: pendingReports.toString(), 
                    icon: 'Clock', 
                    color: '#f59e0b' 
                },
                { 
                    label: 'Student Role', 
                    value: user.studentProfile?.studentRole || 'WS', 
                    icon: 'Award', 
                    color: '#8b5cf6' 
                }
            ],

            // Additional backend data that might be useful
            backendData: {
                userId: user.id,
                username: user.username,
                status: user.status,
                rank: user.rank,
                studentProfileId: user.studentProfile?.id,
                classId: user.studentProfile?.classId,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        };

        return res.status(200).json({
            success: true,
            data: profileData
        });

    } catch (error) {
        return res.status(500).json({
            success: false, 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get admin profile information including admin details and statistics
 */
export const getProfileAdmin = async (req, res) => {
    try {
        // Extract email from query parameters
        const { email } = req.query;

        // Validate required parameter
        if (!email) {
            return res.status(400).json({
                success: false, 
                message: 'Email is required'
            });
        }

        // Fetch user with admin profile information
        const user = await prisma.user.findUnique({
            where: { email: email },  
            include: {
                adminProfile: true
            }
        });

        // Check if user exists
        if (!user) {
            return res.status(404).json({
                success: false, 
                message: 'User not found'
            });
        }

        // Verify user has admin role
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                success: false, 
                message: 'Access denied. Admin role required.'
            });
        }

        // Get report statistics for admin (all reports in the system)
        const totalReports = await prisma.report.count();
        
        // Get approved reports count
        const approvedReports = await prisma.report.count({
            where: {
                status: {
                    in: ['APPROVED', 'REVIEWED']
                }
            }
        });

        // Get pending reports count
        const pendingReports = await prisma.report.count({
            where: {
                status: {
                    in: ['SUBMITTED', 'UNDER_REVIEW', 'PARTIAL']
                }
            }
        });

        // Get rejected reports count
        const rejectedReports = await prisma.report.count({
            where: {
                status: 'REJECTED'
            }
        });

        // Get admin-specific statistics
        const adminReviews = await prisma.reportReview.count({
            where: {
                adminId: user.id
            }
        });

        // Transform data to match frontend format
        const profileData = {
            // Personal Information
            firstName: user.name.split(' ')[0] || user.name,
            lastName: user.name.split(' ').slice(1).join(' ') || '',
            email: user.email,
            phone: user.phone,
            adminId: user.username,
            department: user.adminProfile?.department || 'Administration',
            joinDate: new Date(user.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
            }),
            address: user.address || 'Address not provided',
            role: user.role,
            permissions: user.adminProfile?.permissions || [],
            
            // Statistics for the profile card
            statistics: [
                { 
                    label: 'Total Reports', 
                    value: totalReports.toString(), 
                    icon: 'FileText', 
                    color: '#3b82f6' 
                },
                { 
                    label: 'Approved Reports', 
                    value: approvedReports.toString(), 
                    icon: 'CheckCircle', 
                    color: '#10b981' 
                },
                { 
                    label: 'Pending Reports', 
                    value: pendingReports.toString(), 
                    icon: 'Clock', 
                    color: '#f59e0b' 
                },
                { 
                    label: 'Rejected Reports', 
                    value: rejectedReports.toString(), 
                    icon: 'XCircle', 
                    color: '#ef4444' 
                },
                { 
                    label: 'My Reviews', 
                    value: adminReviews.toString(), 
                    icon: 'Shield', 
                    color: '#8b5cf6' 
                },
                { 
                    label: 'Admin Role', 
                    value: user.role, 
                    icon: 'Award', 
                    color: '#06b6d4' 
                }
            ],

            // Additional backend data that might be useful
            backendData: {
                userId: user.id,
                username: user.username,
                status: user.status,
                rank: user.rank,
                adminProfileId: user.adminProfile?.id,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        };

        return res.status(200).json({
            success: true,
            data: profileData
        });

    } catch (error) {
        return res.status(500).json({
            success: false, 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get comprehensive dashboard data for student
 * Includes statistics, weekly activity, recent activity, and reports
 */
export async function getStudentDashboardData(req, res) {
  try {
    console.log("Fetching Student Dashboard");

    // 1️⃣ Authenticate user
    // if (!req.user) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Authentication required",
    //   });
    // }

    // const userId = req.user.id;

    //get the email from params
    const email = req.params.email;

    //check if the student exist in user table
    const user = await prisma.user.find({
        where: { email },
    });

    console.log("asd")

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "Student not found",
        });
    }

    //check if the user is a student
    if (user.role !== "STUDENT") {
        return res.status(403).json({
            success: false,
            message: "User is not a student",
        });
    }

    //get the student id from user id
    const userId = user.id;
    console.log("userid", userId)
    // 2️⃣ Fetch student profile with single class
    const student = await prisma.student.findUnique({
      where: { userId },
      include: { class: true }, // singular
    });

    if (!student || !student.class) {
      return res.status(404).json({
        success: false,
        message: "Student profile or class not found",
      });
    }

    const classId = student.class.id;
    console.log("classId ", classId)
    // 3️⃣ Total students in the same class
    const totalStudents = await prisma.student.count({
      where: { classId },
    });

    // 4️⃣ Total reports submitted in the class
    const totalReports = await prisma.report.count({
      where: { classId },
    });

    // 5️⃣ Weekly activity
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklyReports = await prisma.report.findMany({
      where: { classId, createdAt: { gte: oneWeekAgo } },
      select: { createdAt: true, itemEvaluated: true },
    });

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyData = daysOfWeek.map((day) => ({ day, count: 0 }));

    weeklyReports.forEach((report) => {
      const dayIndex = report.createdAt.getDay();
      const dayName = daysOfWeek[dayIndex];

      if (report.itemEvaluated && typeof report.itemEvaluated === "object") {
        const goodItems = report.itemEvaluated.goodItems || 0;
        const dayData = weeklyData.find((d) => d.day === dayName);
        if (dayData) dayData.count += goodItems;
      }
    });

    // 6️⃣ Recent Activity
    const recentReports = await prisma.report.findMany({
      where: { classId },
      include: {
        reporter: { select: { name: true, username: true } },
        reviews: {
          include: { admin: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const recentActivity = [];

    recentReports.forEach((report) => {
      // Report submission
      recentActivity.push({
        id: `report-${report.id}`,
        type: "submitted",
        title: report.title,
        time: report.createdAt,
        user: report.reporter.name,
        timestamp: report.createdAt,
      });

      // Admin reviews
      report.reviews.forEach((review) => {
        recentActivity.push({
          id: `review-${review.id}`,
          type: review.status.toLowerCase(),
          title: `${report.title} (Admin Review)`,
          time: review.reviewedAt || review.createdAt,
          user: review.admin?.name || "Admin",
          timestamp: review.reviewedAt || review.createdAt,
        });
      });
    });

    const sortedRecentActivity = recentActivity
      .filter((a) => a.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        time: formatTimeDifference(a.timestamp),
        user: a.user,
      }));

    // 7️⃣ Recent Reports List
    const recentReportsList = await prisma.report.findMany({
      where: { classId },
      select: { id: true, title: true, status: true, createdAt: true, class: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    const formattedRecentReports = recentReportsList.map((report) => ({
      id: report.id,
      title: report.title,
      status: mapReportStatus(report.status),
      date: report.createdAt.toISOString().split("T")[0],
      class: report.class.name,
    }));

    // 8️⃣ Response
    res.json({
      success: true,
      data: {
        stats: [
          { title: "Total Reports", value: totalReports, icon: "FileText", trend: 0, color: "#3b82f6" },
          { title: "Active Students", value: totalStudents, icon: "Users", trend: 0, color: "#10b981" },
        ],
        weeklyData,
        recentActivity: sortedRecentActivity,
        recentReports: formattedRecentReports,
      },
    });
  } catch (error) {
    console.error("Error loading student dashboard:", error);
    res.status(502).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}


/**
 * Format timestamp to relative time string
 * @param {Date} timestamp - The timestamp to format
 * @returns {string} Relative time string
 */
function formatTimeDifference(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

/**
 * Map Prisma report status to frontend status
 * @param {string} prismaStatus - Status from Prisma database
 * @returns {string} Mapped status for frontend
 */
function mapReportStatus(prismaStatus) {
    const statusMap = {
        'DRAFT': 'draft',
        'SUBMITTED': 'pending',
        'UNDER_REVIEW': 'pending',
        'PARTIAL': 'pending',
        'APPROVED': 'approved',
        'REVIEWED': 'approved',
        'REJECTED': 'rejected'
    };
    
    return statusMap[prismaStatus] || 'pending';
}



export const updateProfileUser = async (req, res) => {
    try {
        console.log("Update profile request received:", {
            user: req.user,
            body: req.body
        });

        const id = req.user.id;
        
        // Fix: Check both req.body.updates and req.body
        const updates = req.body.updates || req.body;
        const { name, email, phone, address, newClass } = updates;
        
        console.log("Extracted updates:", { name, email, phone, address, newClass });

        let classId = null;
        
        // Check if newClass is provided and get the class ID
        if (newClass) {
            // Check if the class exists by name
            const classExists = await prisma.class.findUnique({
                where: { name: newClass }
            });
            
            if (!classExists) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid class name"
                });
            }
            classId = classExists.id;
            console.log("Found class ID:", classId);
        }

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required fields"
            });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id },
            include: { studentProfile: true }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        console.log("Existing user:", existingUser);

        // Prepare update data
        const updateData = {
            name,
            email,
            ...(phone !== undefined && { phone: phone || null }),
            ...(address !== undefined && { address: address || null }),
        };

        console.log("Update data:", updateData);

        // Handle student profile update if classId is provided
        if (classId && existingUser.role === 'STUDENT') {
            console.log("Processing class update for student");
            
            // Use transaction to ensure both updates succeed or fail together
            await prisma.$transaction(async (tx) => {
                // Update user
                await tx.user.update({
                    where: { id },
                    data: updateData
                });

                // Update or create student profile
                if (existingUser.studentProfile) {
                    console.log("Updating existing student profile");
                    await tx.student.update({
                        where: { userId: id },
                        data: { classId: classId }
                    });
                } else {
                    console.log("Creating new student profile");
                    await tx.student.create({
                        data: {
                            userId: id,
                            classId: classId
                        }
                    });
                }
            });
        } else {
            console.log("Updating user only");
            // Update user only
            await prisma.user.update({
                where: { id },
                data: updateData
            });
        }

        // Fetch updated user data with proper formatting to match getProfileUser
        const updatedUser = await prisma.user.findUnique({
            where: { id },
            include: {
                studentProfile: {
                    include: {
                        class: {
                            select: {
                                id: true,
                                name: true,
                                description: true
                            }
                        }
                    }
                }
            }
        });

        console.log("Update successful, returning formatted data");

        // Format the response to match getProfileUser structure
        const formattedResponse = {
            // Personal Information
            firstName: updatedUser.name.split(' ')[0] || updatedUser.name,
            lastName: updatedUser.name.split(' ').slice(1).join(' ') || '',
            email: updatedUser.email,
            phone: updatedUser.phone,
            studentId: updatedUser.username,
            class: updatedUser.studentProfile?.class?.name || 'Not assigned',
            department: updatedUser.studentProfile?.class?.description || 'General Studies',
            enrollmentDate: new Date(updatedUser.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
            }),
            address: updatedUser.address || 'Address not provided',
            dateOfBirth: updatedUser.createdAt.toISOString().split('T')[0],
            
            // Student role
            studentRole: updatedUser.studentProfile?.studentRole || 'WS',
            
            // Statistics (you might want to recalculate these or keep existing ones)
            statistics: [
                { 
                    label: 'Reports Submitted', 
                    value: '0', 
                    icon: 'FileText', 
                    color: '#3b82f6' 
                },
                { 
                    label: 'Approved Reports', 
                    value: '0', 
                    icon: 'CheckCircle', 
                    color: '#10b981' 
                },
                { 
                    label: 'Pending Reports', 
                    value: '0', 
                    icon: 'Clock', 
                    color: '#f59e0b' 
                },
                { 
                    label: 'Student Role', 
                    value: updatedUser.studentProfile?.studentRole || 'WS', 
                    icon: 'Award', 
                    color: '#8b5cf6' 
                }
            ],

            // Additional backend data
            backendData: {
                userId: updatedUser.id,
                username: updatedUser.username,
                status: updatedUser.status,
                rank: updatedUser.rank,
                studentProfileId: updatedUser.studentProfile?.id,
                classId: updatedUser.studentProfile?.classId,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt
            }
        };

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: formattedResponse
        });

    } catch (error) {
        console.error("Update profile error:", error);
        console.error("Error details:", {
            code: error.code,
            meta: error.meta,
            message: error.message
        });

        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0];
            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });
        }

        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Record not found"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}