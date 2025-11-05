import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";

const prisma = new PrismaClient();

/**
 * Get reports for student's class with filtering and pagination
 */
export const getReport = async (req, res) => {
  try {
    const { filter, searchQuery } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const studentEmail = req.user?.email;

    if (!studentEmail) {
      return res.status(400).json({
        success: false,
        message: 'Student email is required',
      });
    }

    // Fetch user and student's class
    const user = await prisma.user.findUnique({
      where: { email: studentEmail },
      include: {
        studentProfile: {
          include: { class: true },
        },
      },
    });

    if (!user || user.role !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Student role required.',
      });
    }

    const studentClass = user.studentProfile?.class;
    if (!studentClass) {
      return res.status(404).json({
        success: false,
        message: 'Student is not assigned to any class',
      });
    }

    const classId = studentClass.id;

    // Calculate date range if filter exists
    const dateRange = filter ? calculateDateRange(filter) : null;

    const whereClause = {
      classId,
      ...(dateRange && {
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      }),
      ...(searchQuery && {
        OR: [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          { generalComment: { contains: searchQuery, mode: 'insensitive' } },
        ],
      }),
    };

    const skip = (page - 1) * limit;
    const take = limit;

    // Fetch reports and count in parallel
    const [reports, totalCount] = await Promise.all([
      prisma.report.findMany({
        where: whereClause,
        include: {
          class: { select: { name: true } },
          reviews: {
            include: { admin: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          reporter: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.report.count({ where: whereClause }),
    ]);

    // Transform for frontend
    const transformedReports = reports.map((report) => ({
      id: report.id,
      title: report.title,
      reporter: report.reporter?.name || 'Unknown',
      submissionDate: report.createdAt.toISOString().split('T')[0],
      status: report.status,
      class: report.class?.name || 'N/A',
      generalComment: report.generalComment,
      itemEvaluated: report.itemEvaluated,
      category: report.category,
      reviews: report.reviews.map((r) => ({
        id: r.id,
        status: r.status,
        comments: r.comments,
        admin: r.admin?.name || 'Admin',
        reviewedAt: r.reviewedAt,
      })),
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        reports: transformedReports,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalReports: totalCount,
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Save a new report submission
 */

export const saveReport = async (req, res) => {
  try {
    const {
      reporterEmail,
      itemEvaluated,
      generalComment,
      title,
      category = ReportCategory.ONTIME,
    } = req.body;

    // Validate required fields
    if (!reporterEmail || !itemEvaluated) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get user from email
    const user = await prisma.user.findUnique({
      where: { email: reporterEmail },
      select: { id: true, studentProfile: true },
    });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Fetch student class info
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: { class: true },
    });

    const reporterId = user.id;
    const classId = student?.class?.id;

    if (!classId) {
      return res.status(400).json({ message: "User not assigned to any class" });
    }

    // Check if report already exists today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId,
        classId,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    });

    if (existingReport) {
      return res.status(400).json({
        message: "You have already submitted a report for this class today",
      });
    }

    // Save the report
    const report = await prisma.report.create({
      data: {
        title: title || `Inspection Report ${new Date().toLocaleDateString()}`,
        reporterId,
        classId,
        itemEvaluated,
        generalComment: generalComment || "",
        category,
      },
    });

    // Automatically create initial report review record (optional)
    await prisma.reportReview.create({
      data: {
        reportId: report.id,
        status: "PENDING",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    console.error("Error submitting report:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


/**
 * Get detailed report by ID
 */
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }

    // Fetch report with related data
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, name: true, email: true },
        },
        class: {
          select: { id: true, name: true },
        },
        reviews: {
          include: {
            admin: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Transform data for frontend
    const responseData = {
      id: report.id,
      title: report.title,
      class: report.class?.name || "N/A",
      reporter: {
        name: report.reporter?.name || "Unknown",
        email: report.reporter?.email || "N/A",
      },
      category: report.category,
      status: report.status, // or mapReportStatus(report.status) if you have a mapping function
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      generalComment: report.generalComment || "",
      itemEvaluated: report.itemEvaluated || {},

      // Only reviews remain, no approvals
      reviews: report.reviews?.map((review) => ({
        id: review.id,
        admin: review.admin?.name || "Unknown",
        status: review.status,
        comments: review.comments,
        reviewedAt: review.reviewedAt,
      })) || [],
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching report by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Download report as PDF
 */
export const downloadReport = async (req, res) => {
    const reportId = req.params.id;

    try {
        // Fetch report with related data
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                reporter: true,
                class: true,
                approvals: true,
                reviews: true,
            },
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${report.title || `report-${reportId}`}.pdf"`
        );

        // Create PDF document
        const doc = new PDFDocument();
        doc.pipe(res);

        // Add title and basic information
        doc.fontSize(20).text(report.title || 'Report', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12);
        doc.text(`Report ID: ${report.id}`);
        doc.text(`Status: ${report.status}`);
        doc.text(`Category: ${report.category}`);
        doc.text(`Created: ${report.createdAt.toLocaleDateString()}`);
        doc.moveDown();

        // Handle itemEvaluated JSON data
        if (report.itemEvaluated) {
            doc.text('Items Evaluated:', { underline: true });
            doc.moveDown(0.5);
            
            try {
                const items = typeof report.itemEvaluated === 'string' 
                    ? JSON.parse(report.itemEvaluated) 
                    : report.itemEvaluated;
                
                if (typeof items === 'object') {
                    if (Array.isArray(items)) {
                        items.forEach((item, index) => {
                            if (typeof item === 'object') {
                                doc.text(`${index + 1}. ${JSON.stringify(item, null, 2)}`);
                            } else {
                                doc.text(`${index + 1}. ${item}`);
                            }
                        });
                    } else {
                        Object.entries(items).forEach(([key, value]) => {
                            doc.text(`${key}: ${JSON.stringify(value)}`);
                        });
                    }
                } else {
                    doc.text(String(items));
                }
            } catch (jsonError) {
                doc.text('Error parsing evaluated items data');
            }
        } else {
            doc.text('Items Evaluated: N/A');
        }

        doc.moveDown();

        // Add general comment
        doc.text('General Comment:', { underline: true });
        doc.moveDown(0.5);
        doc.text(report.generalComment || 'No comments provided');
        doc.moveDown();

        // Add approvals section if exists
        if (report.approvals) {
            doc.text('Approvals:', { underline: true });
            doc.moveDown(0.5);
            doc.text(`Approval Status: ${report.approvals.status || 'N/A'}`);
        }

        // Add reviews section if exists
        if (report.reviews && report.reviews.length > 0) {
            doc.text('Reviews:', { underline: true });
            doc.moveDown(0.5);
            report.reviews.forEach((review, index) => {
                doc.text(`Review ${index + 1}: ${review.comments || 'No comments'}`);
            });
        }

        doc.end();

    } catch (err) {
        // Check if headers were already sent
        if (res.headersSent) {
            return;
        }
        
        res.status(500).json({ 
            error: 'Server error during download',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

/**
 * Get today's report for approval (CS/CP roles)
 */
export const getApprovalReport = async (req, res) => {
    try {
        // Get studentEmail from authenticated user
        const studentEmail = req.user.email;

        if (!studentEmail) {
            return res.status(400).json({
                success: false,
                message: "User email not found",
            });
        }

        // Find user and their role
        const user = await prisma.user.findUnique({
            where: { email: studentEmail },
            include: {
                studentProfile: {
                    include: {
                        class: true,
                    },
                },
            },
        });

        if (!user || !user.studentProfile) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        const student = user.studentProfile;
        const studentRole = student.studentRole;
        const classId = student.classId;

        // Validate class assignment
        if (!classId) {
            return res.status(400).json({
                success: false,
                message: "Student is not assigned to any class",
            });
        }

        // Check if user has permission to approve (CS or CP)
        if (!["CS", "CP"].includes(studentRole)) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to approve reports",
            });
        }

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find today's report for the student's class
        const todaysReport = await prisma.report.findFirst({
            where: {
                classId: classId,
                createdAt: {
                    gte: today,
                    lt: tomorrow,
                },
            },
            include: {
                reporter: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                class: {
                    select: {
                        name: true,
                    },
                },
                approvals: {
                    include: {
                        csStudent: {
                            select: {
                                name: true,
                                email: true,
                            },
                        },
                        cpStudent: {
                            select: {
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                reviews: {
                    include: {
                        admin: {
                            select: {
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        if (!todaysReport) {
            return res.status(404).json({
                success: false,
                message: "No report found for today",
                data: null,
            });
        }

        // Determine user and other role's actions
        let userAction = null;
        let otherRoleAction = null;

        if (todaysReport.approvals) {
            // Current user's action
            if (studentRole === "CS") {
                if (todaysReport.approvals.commentsCS) {
                    const isApproved =
                        todaysReport.approvals.commentsCS
                            ?.toLowerCase()
                            .includes("approved") ||
                        todaysReport.approvals.commentsCS ===
                            "Report approved successfully";

                    userAction = {
                        approved: isApproved,
                        comments: todaysReport.approvals.commentsCS,
                        approvedAt: todaysReport.approvals.approvedAtCS,
                        category: todaysReport.approvals.approvalCatCS,
                    };
                }

                // Other role (CP)
                if (todaysReport.approvals.commentsCP) {
                    const isOtherApproved =
                        todaysReport.approvals.commentsCP
                            ?.toLowerCase()
                            .includes("approved") ||
                        todaysReport.approvals.commentsCP ===
                            "Report approved successfully";

                    otherRoleAction = {
                        role: "CP",
                        approved: isOtherApproved,
                        comments: todaysReport.approvals.commentsCP,
                        approvedAt: todaysReport.approvals.approvedAtCP,
                        student: todaysReport.approvals.cpStudent,
                    };
                }
            } else {
                // Current user is CP
                if (todaysReport.approvals.commentsCP) {
                    const isApproved =
                        todaysReport.approvals.commentsCP
                            ?.toLowerCase()
                            .includes("approved") ||
                        todaysReport.approvals.commentsCP ===
                            "Report approved successfully";

                    userAction = {
                        approved: isApproved,
                        comments: todaysReport.approvals.commentsCP,
                        approvedAt: todaysReport.approvals.approvedAtCP,
                        category: todaysReport.approvals.approvalCatCP,
                    };
                }

                // Other role (CS)
                if (todaysReport.approvals.commentsCS) {
                    const isOtherApproved =
                        todaysReport.approvals.commentsCS
                            ?.toLowerCase()
                            .includes("approved") ||
                        todaysReport.approvals.commentsCS ===
                            "Report approved successfully";

                    otherRoleAction = {
                        role: "CS",
                        approved: isOtherApproved,
                        comments: todaysReport.approvals.commentsCS,
                        approvedAt: todaysReport.approvals.approvedAtCS,
                        student: todaysReport.approvals.csStudent,
                    };
                }
            }
        }

        // Always return today's report, even if action already taken
        return res.status(200).json({
            success: true,
            message: "Today's report retrieved successfully",
            data: {
                report: todaysReport,
                userAction,
                otherRoleAction,
                studentRole,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Approve a report (CS/CP roles)
 */
export const approveReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { comments } = req.body;
        const studentEmail = req.user.email;

        // Validate inputs
        if (!studentEmail) {
            return res.status(400).json({
                success: false,
                message: "User email not found"
            });
        }

        if (!reportId) {
            return res.status(400).json({
                success: false,
                message: "Report ID is required"
            });
        }

        // Find user and their role
        const user = await prisma.user.findUnique({
            where: { email: studentEmail },
            include: {
                studentProfile: {
                    include: {
                        class: true
                    }
                }
            }
        });

        if (!user || !user.studentProfile) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const student = user.studentProfile;
        const studentRole = student.studentRole;
        const classId = student.classId;

        // Check if user has permission to approve (CS or CP)
        if (!['CS', 'CP'].includes(studentRole)) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to approve reports"
            });
        }

        // Find the report
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                approvals: true
            }
        });

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        // Check if report belongs to student's class
        if (report.classId !== classId) {
            return res.status(403).json({
                success: false,
                message: "You can only approve reports from your class"
            });
        }

        // Check if user has already taken action
        const existingApproval = report.approvals;
        if (studentRole === 'CS' && existingApproval?.approvalCatCS !== null) {
            return res.status(400).json({
                success: false,
                message: "You have already taken action on this report"
            });
        }
        if (studentRole === 'CP' && existingApproval?.approvalCatCP !== null) {
            return res.status(400).json({
                success: false,
                message: "You have already taken action on this report"
            });
        }

        // Update or create approval - set to TRUE for approval
        const updateData = {
            reportId: reportId,
            ...(studentRole === 'CS' ? {
                csStudentId: user.id,
                approvedByCS: true,
                approvedAtCS: new Date(),
                commentsCS: comments || "Report approved successfully",
                approvalCatCS: report.category
            } : {
                cpStudentId: user.id,
                approvedByCP: true,
                approvedAtCP: new Date(),
                commentsCP: comments || "Report approved successfully",
                approvalCatCP: report.category
            })
        };

        // Upsert approval record
        const approval = await prisma.reportApproval.upsert({
            where: { reportId: reportId },
            update: updateData,
            create: updateData
        });

        // Check if both CS and CP have approved to update report status
        const updatedApproval = await prisma.reportApproval.findUnique({
            where: { reportId: reportId }
        });

        let reportStatus = report.status;
        
        if (updatedApproval?.approvedByCS === true && updatedApproval?.approvedByCP === true) {
            // Both have approved - move to UNDER_REVIEW
            reportStatus = 'UNDER_REVIEW';
        } else if (updatedApproval?.approvedByCS === false || updatedApproval?.approvedByCP === false) {
            // Someone denied - move to REJECTED
            reportStatus = 'REJECTED';
        } else {
            // Partial approval (one approved, one pending)
            reportStatus = 'PARTIAL';
        }

        // Update report status
        await prisma.report.update({
            where: { id: reportId },
            data: { status: reportStatus }
        });

        return res.status(200).json({
            success: true,
            message: "Report approved successfully",
            data: {
                approval: approval,
                reportStatus: reportStatus,
                action: 'approved'
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Deny a report (CS/CP roles)
 */
export const denyReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { comments } = req.body;
        const studentEmail = req.user.email;

        // Validate inputs
        if (!studentEmail) {
            return res.status(400).json({
                success: false,
                message: "User email not found"
            });
        }

        if (!reportId) {
            return res.status(400).json({
                success: false,
                message: "Report ID is required"
            });
        }

        if (!comments || !comments.trim()) {
            return res.status(400).json({
                success: false,
                message: "Comments are required when denying a report"
            });
        }

        // Find user and their role
        const user = await prisma.user.findUnique({
            where: { email: studentEmail },
            include: {
                studentProfile: {
                    include: {
                        class: true
                    }
                }
            }
        });

        if (!user || !user.studentProfile) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const student = user.studentProfile;
        const studentRole = student.studentRole;
        const classId = student.classId;

        // Check if user has permission to approve (CS or CP)
        if (!['CS', 'CP'].includes(studentRole)) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to approve reports"
            });
        }

        // Find the report
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                approvals: true
            }
        });

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        // Check if report belongs to student's class
        if (report.classId !== classId) {
            return res.status(403).json({
                success: false,
                message: "You can only approve reports from your class"
            });
        }

        // Check if user has already taken action
        const existingApproval = report.approvals;
        if (studentRole === 'CS' && existingApproval?.approvedByCS !== null) {
            return res.status(400).json({
                success: false,
                message: "You have already taken action on this report"
            });
        }
        if (studentRole === 'CP' && existingApproval?.approvedByCP !== null) {
            return res.status(400).json({
                success: false,
                message: "You have already taken action on this report"
            });
        }

        // Update or create approval with denial - set to FALSE for denial
        const updateData = {
            reportId: reportId,
            ...(studentRole === 'CS' ? {
                csStudentId: user.id,
                approvedByCS: false,
                approvedAtCS: new Date(),
                commentsCS: comments.trim(),
                approvalCatCS: null
            } : {
                cpStudentId: user.id,
                approvedByCP: false,
                approvedAtCP: new Date(),
                commentsCP: comments.trim(),
                approvalCatCP: null
            })
        };

        // Upsert approval record
        const approval = await prisma.reportApproval.upsert({
            where: { reportId: reportId },
            update: updateData,
            create: updateData
        });

        // Update report status to REJECTED when someone denies
        await prisma.report.update({
            where: { id: reportId },
            data: { status: 'REJECTED' }
        });

        return res.status(200).json({
            success: true,
            message: "Report denied successfully",
            data: {
                approval: approval,
                reportStatus: 'REJECTED',
                action: 'denied'
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Helper function to calculate date range based on filter
 */
function calculateDateRange(filter) {
    const now = new Date();
    
    switch (filter) {
        case 'daily':
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            return {
                start: startOfDay,
                end: now
            };
            
        case 'weekly':
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - 7);
            return {
                start: startOfWeek,
                end: now
            };
            
        case 'monthly':
            const startOfMonth = new Date(now);
            startOfMonth.setDate(now.getDate() - 30);
            return {
                start: startOfMonth,
                end: now
            };
            
        case 'all':
        default:
            return null; // No date filter
    }
}

/**
 * Helper function to map database status to frontend status
 */
function mapReportStatus(dbStatus, approvals) {
    const statusMap = {
        'DRAFT': 'pending',
        'SUBMITTED': 'pending',
        'UNDER_REVIEW': 'pending',
        'PARTIAL': 'pending',
        'APPROVED': 'approved',
        'REVIEWED': 'approved',
        'REJECTED': 'rejected'
    };

    // If report is approved by both CS and CP, consider it approved
    if (approvals?.approvedByCS && approvals?.approvedByCP) {
        return 'approved';
    }

    // If report is rejected in reviews, consider it rejected
    if (dbStatus === 'REJECTED') {
        return 'rejected';
    }

    return statusMap[dbStatus] || 'pending';
}

/**
 * Helper to map report status to readable string
 */
function mapReportStatusDetailed(status, approvals) {
    if (status === 'APPROVED') return 'Approved';
    if (status === 'REJECTED') return 'Rejected';
    if (approvals?.approvedByCS && approvals?.approvedByCP) return 'Fully Approved';
    if (approvals?.approvedByCS || approvals?.approvedByCP) return 'Partially Approved';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}