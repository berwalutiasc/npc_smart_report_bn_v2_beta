import { PrismaClient } from "@prisma/client";


const prisma  = new PrismaClient();



export const getAdminDashboardData = async (req, res) => {
    try {
        const {
            totalStudents,
            totalRepresentatives,
            totalClasses,
            totalReports,
            weeklyReportData,
            recentActivities,
            recentReports
        } = await prisma.$transaction(async (tx) => {
            // 1. Total Students Count
            const totalStudents = await tx.user.count({
                where: {
                    role: 'STUDENT',
                    status: 'ACTIVE'
                }
            });

            // 2. Total Representatives (Students with specific roles - CS, CP, CC, WS)
            const totalRepresentatives = await tx.student.count({
                where: {
                    studentRole: {
                        in: ['CS', 'CP', 'CC', 'WS']
                    },
                    user: {
                        status: 'ACTIVE'
                    }
                }
            });

            // 3. Total Classes Count
            const totalClasses = await tx.class.count();

            // 4. Total Reports Count
            const totalReports = await tx.report.count();

            // 5. Weekly Report Activity Data (Last 7 days)
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - 7);
            startOfWeek.setHours(0, 0, 0, 0);

            const weeklyReports = await tx.report.groupBy({
                by: ['createdAt'],
                where: {
                    createdAt: {
                        gte: startOfWeek
                    }
                },
                _count: {
                    id: true
                }
            });

            // Format weekly data for chart
            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const weeklyReportData = daysOfWeek.map(day => ({
                day,
                count: 0
            }));

            weeklyReports.forEach(report => {
                const dayIndex = new Date(report.createdAt).getDay();
                weeklyReportData[dayIndex].count += report._count.id;
            });

            // 6. Recent Activities (Last 10 report-related activities)
            const recentReportActivities = await tx.report.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                    }
                },
                include: {
                    reporter: {
                        include: {
                            studentProfile: {
                                include: {
                                    class: true
                                }
                            }
                        }
                    },
                    approvals: {
                        include: {
                            csStudent: true,
                            cpStudent: true
                        }
                    },
                    reviews: {
                        include: {
                            admin: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10
            });

            // Transform activities to match frontend format
            const recentActivities = recentReportActivities.map(report => {
                let activityType = 'submitted';
                let title = `${report.title}`;
                let user = '';

                // Determine activity type based on report status and approvals
                if (report.status === 'APPROVED' || report.status === 'REVIEWED') {
                    activityType = 'approved';
                } else if (report.status === 'UNDER_REVIEW' || report.status === 'PARTIAL') {
                    activityType = 'pending';
                }

                // Get user information
                if (report.reporter.studentProfile) {
                    const className = report.reporter.studentProfile.class?.name || 'Unknown Class';
                    user = `${report.reporter.name} (${className})`;
                } else {
                    user = report.reporter.name;
                }

                // Calculate time ago
                const timeDiff = Date.now() - new Date(report.createdAt).getTime();
                const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutesAgo = Math.floor(timeDiff / (1000 * 60));
                
                let timeAgo = '';
                if (hoursAgo > 0) {
                    timeAgo = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
                } else {
                    timeAgo = `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
                }

                return {
                    id: report.id,
                    type: activityType,
                    title: title,
                    time: timeAgo,
                    user: user
                };
            });

            // 7. Recent Reports (Last 10 reports with detailed info)
            const recentReportsData = await tx.report.findMany({
                include: {
                    reporter: {
                        include: {
                            studentProfile: {
                                include: {
                                    class: true
                                }
                            }
                        }
                    },
                    class: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10
            });

            // Transform reports to match frontend format
            const recentReports = recentReportsData.map(report => {
                // Map status to frontend status
                let status = 'pending';
                if (report.status === 'APPROVED' || report.status === 'REVIEWED') {
                    status = 'approved';
                } else if (report.status === 'REJECTED') {
                    status = 'flagged';
                }

                const representative = report.reporter.name;
                const className = report.class.name;

                return {
                    id: report.id,
                    title: report.title,
                    status: status,
                    date: report.createdAt.toISOString().split('T')[0],
                    representative: representative,
                    class: className
                };
            });

            return {
                totalStudents,
                totalRepresentatives,
                totalClasses,
                totalReports,
                weeklyReportData,
                recentActivities,
                recentReports
            };
        });

        // Calculate trends (you might want to compare with previous period)
        // For now, using mock trends as shown in frontend
        const trends = {
            students: 12.5,
            representatives: 5.3,
            classes: 0,
            reports: 18.7
        };

        // Format the response to match frontend expectations
        const response = {
            stats: [
                {
                    title: 'Total Students',
                    value: totalStudents,
                    trend: trends.students,
                    color: '#3b82f6'
                },
                {
                    title: 'Representatives',
                    value: totalRepresentatives,
                    trend: trends.representatives,
                    color: '#10b981'
                },
                {
                    title: 'Total Classes',
                    value: totalClasses,
                    trend: trends.classes,
                    color: '#f59e0b'
                },
                {
                    title: 'Total Reports',
                    value: totalReports,
                    trend: trends.reports,
                    color: '#8b5cf6'
                }
            ],
            weeklyData: weeklyReportData,
            activities: recentActivities,
            recentReports: recentReports
        };

        return res.status(200).json({
            success: true,
            data: response,
            message: "Dashboard data fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};



export const getTodayReport = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const {
            todayReports,
            stats
        } = await prisma.$transaction(async (tx) => {
            // 1. Fetch all reports submitted today
            const todayReports = await tx.report.findMany({
                where: {
                    createdAt: {
                        gte: today,
                        lt: tomorrow
                    }
                },
                include: {
                    reporter: {
                        include: {
                            studentProfile: {
                                include: {
                                    class: true
                                }
                            }
                        }
                    },
                    class: true,
                    approvals: {
                        include: {
                            csStudent: true,
                            cpStudent: true
                        }
                    },
                    reviews: {
                        include: {
                            admin: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            // 2. Calculate statistics
            const totalReports = todayReports.length;
            const pendingReports = todayReports.filter(report => 
                report.status === 'SUBMITTED' || 
                report.status === 'UNDER_REVIEW' || 
                report.status === 'PARTIAL'
            ).length;
            const approvedReports = todayReports.filter(report => 
                report.status === 'APPROVED' || 
                report.status === 'REVIEWED'
            ).length;

            // Calculate flagged items (reports with REJECTED status or items with issues)
            const flaggedReports = todayReports.filter(report => 
                report.status === 'REJECTED'
            ).length;

            return {
                todayReports,
                stats: {
                    total: totalReports,
                    pending: pendingReports,
                    approved: approvedReports,
                    flagged: flaggedReports
                }
            };
        });

        // Transform data to match frontend format
        const transformedReports = todayReports.map(report => {
            // Map backend status to frontend status
            let status = 'pending';
            if (report.status === 'APPROVED' || report.status === 'REVIEWED') {
                status = 'approved';
            } else if (report.status === 'REJECTED') {
                status = 'rejected';
            }

            // Parse itemEvaluated JSON to get item counts
            const itemsEvaluated = report.itemEvaluated;
            const totalItems = itemsEvaluated?.length || 0;
            const itemsChecked = itemsEvaluated?.filter(item => 
                item.status === 'GOOD' || item.status === 'BAD' || item.status === 'FLAGGED'
            ).length || 0;
            const flaggedItems = itemsEvaluated?.filter(item => 
                item.status === 'BAD' || item.status === 'FLAGGED'
            ).length || 0;

            // Format time
            const time = report.createdAt.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });

            return {
                id: report.id,
                title: report.title,
                representative: report.reporter.name,
                class: report.class.name,
                status: status,
                time: time,
                itemsChecked: itemsChecked,
                totalItems: totalItems,
                flaggedItems: flaggedItems,
                // Include raw data for modal details
                rawData: {
                    generalComment: report.generalComment,
                    itemsEvaluated: itemsEvaluated,
                    approvals: report.approvals,
                    reviews: report.reviews
                }
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                reports: transformedReports,
                stats: stats,
                date: today.toISOString().split('T')[0],
                displayDate: today.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })
            },
            message: "Today's reports fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching today reports:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};


export const getAllReports = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = 'all',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build where clause for filtering
        const whereClause = {};

        // Status filter mapping
        if (status !== 'all') {
            const statusMap = {
                'pending': ['SUBMITTED', 'UNDER_REVIEW', 'PARTIAL'],
                'approved': ['APPROVED', 'REVIEWED'],
                'rejected': ['REJECTED']
            };

            whereClause.status = {
                in: statusMap[status]
            };
        }

        // Search filter
        if (search) {
            whereClause.OR = [
                {
                    title: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    reporter: {
                        name: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                },
                {
                    class: {
                        name: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                }
            ];
        }

        const {
            reports,
            totalCount,
            stats
        } = await prisma.$transaction(async (tx) => {
            // 1. Fetch paginated reports with filters
            const reports = await tx.report.findMany({
                where: whereClause,
                include: {
                    reporter: {
                        include: {
                            studentProfile: {
                                include: {
                                    class: true
                                }
                            }
                        }
                    },
                    class: true,
                    approvals: {
                        include: {
                            csStudent: true,
                            cpStudent: true
                        }
                    },
                    reviews: {
                        include: {
                            admin: true
                        }
                    }
                },
                orderBy: {
                    [sortBy]: sortOrder
                },
                skip: skip,
                take: limitNum
            });

            // 2. Get total count for pagination
            const totalCount = await tx.report.count({
                where: whereClause
            });

            // 3. Get overall statistics
            const totalReports = await tx.report.count();
            const pendingReports = await tx.report.count({
                where: {
                    status: {
                        in: ['SUBMITTED', 'UNDER_REVIEW', 'PARTIAL']
                    }
                }
            });
            const approvedReports = await tx.report.count({
                where: {
                    status: {
                        in: ['APPROVED', 'REVIEWED']
                    }
                }
            });
            const rejectedReports = await tx.report.count({
                where: {
                    status: 'REJECTED'
                }
            });

            return {
                reports,
                totalCount,
                stats: {
                    total: totalReports,
                    pending: pendingReports,
                    approved: approvedReports,
                    rejected: rejectedReports
                }
            };
        });

        // Transform data to match frontend format
        const transformedReports = reports.map(report => {
            // Map backend status to frontend status
            let status = 'pending';
            if (report.status === 'APPROVED' || report.status === 'REVIEWED') {
                status = 'approved';
            } else if (report.status === 'REJECTED') {
                status = 'rejected';
            }

            // Parse itemEvaluated JSON to get item counts
            const itemsEvaluated = report.itemEvaluated;
            const totalItems = itemsEvaluated?.length || 0;
            const itemsChecked = itemsEvaluated?.filter(item => 
                item.status === 'GOOD' || item.status === 'BAD' || item.status === 'FLAGGED'
            ).length || 0;
            const flaggedItems = itemsEvaluated?.filter(item => 
                item.status === 'BAD' || item.status === 'FLAGGED'
            ).length || 0;

            // Format dates and times
            const date = report.createdAt.toLocaleDateString();
            const time = report.createdAt.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });

            return {
                id: report.id,
                title: report.title,
                representative: report.reporter.name,
                class: report.class.name,
                status: status,
                time: time,
                date: date,
                itemsChecked: itemsChecked,
                totalItems: totalItems,
                flaggedItems: flaggedItems,
                // Include raw data for modal details
                rawData: {
                    generalComment: report.generalComment,
                    itemsEvaluated: itemsEvaluated,
                    approvals: report.approvals,
                    reviews: report.reviews,
                    createdAt: report.createdAt,
                    updatedAt: report.updatedAt
                }
            };
        });

        const totalPages = Math.ceil(totalCount / limitNum);

        return res.status(200).json({
            success: true,
            data: {
                reports: transformedReports,
                pagination: {
                    currentPage: pageNum,
                    totalPages: totalPages,
                    totalCount: totalCount,
                    hasNext: pageNum < totalPages,
                    hasPrev: pageNum > 1
                },
                stats: stats,
                filters: {
                    search,
                    status,
                    sortBy,
                    sortOrder
                }
            },
            message: "All reports fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching all reports:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};




export const getWeeklyReport = async (req, res) => {
    try {
        // Calculate date range for the current week (Monday to Sunday)
        const today = new Date();
        const startOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(today.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Get all reports from this week
        const weeklyReports = await prisma.report.findMany({
            where: {
                createdAt: {
                    gte: startOfWeek,
                    lte: endOfWeek
                }
            },
            include: {
                reporter: {
                    include: {
                        studentProfile: {
                            include: {
                                class: true
                            }
                        }
                    }
                },
                class: true,
                approvals: true,
                reviews: true
            }
        });

        // Calculate weekly statistics
        const totalReports = weeklyReports.length;
        const uniqueReporterIds = [...new Set(weeklyReports.map(report => report.reporterId))];
        const totalRepresentatives = uniqueReporterIds.length;
        
        // Calculate flagged items
        const flaggedReports = weeklyReports.filter(report => {
            const itemsEvaluated = report.itemEvaluated || [];
            return itemsEvaluated.some(item => 
                item.status === 'BAD' || item.status === 'FLAGGED'
            ) || report.status === 'REJECTED';
        });
        
        const resolvedIssues = weeklyReports.filter(report => 
            report.status === 'APPROVED' || report.status === 'REVIEWED'
        ).length;

        // Calculate trend (compare with previous week)
        const previousWeekStart = new Date(startOfWeek);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);
        const previousWeekEnd = new Date(endOfWeek);
        previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

        const previousWeekReports = await prisma.report.count({
            where: {
                createdAt: {
                    gte: previousWeekStart,
                    lte: previousWeekEnd
                }
            }
        });

        const trend = previousWeekReports > 0 ? 
            ((totalReports - previousWeekReports) / previousWeekReports * 100) : 0;

        // Daily breakdown
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dailyBreakdown = daysOfWeek.map(dayName => {
            const dayIndex = daysOfWeek.indexOf(dayName);
            const dayStart = new Date(startOfWeek);
            dayStart.setDate(startOfWeek.getDate() + dayIndex);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const dayReports = weeklyReports.filter(report => {
                const reportDate = new Date(report.createdAt);
                return reportDate >= dayStart && reportDate <= dayEnd;
            });

            const approvedReports = dayReports.filter(report => 
                report.status === 'APPROVED' || report.status === 'REVIEWED'
            ).length;

            const flaggedDayReports = dayReports.filter(report => {
                const itemsEvaluated = report.itemEvaluated || [];
                return itemsEvaluated.some(item => 
                    item.status === 'BAD' || item.status === 'FLAGGED'
                ) || report.status === 'REJECTED';
            }).length;

            return {
                day: dayName,
                reports: dayReports.length,
                flagged: flaggedDayReports,
                approved: approvedReports
            };
        });

        // Top performers (students with most approved reports)
        const reporterStats = {};
        weeklyReports.forEach(report => {
            const reporterId = report.reporterId;
            if (!reporterStats[reporterId]) {
                reporterStats[reporterId] = {
                    reporter: report.reporter,
                    totalReports: 0,
                    approvedReports: 0,
                    completionRate: 0
                };
            }
            
            reporterStats[reporterId].totalReports++;
            if (report.status === 'APPROVED' || report.status === 'REVIEWED') {
                reporterStats[reporterId].approvedReports++;
            }

            // Calculate completion rate based on items checked
            const itemsEvaluated = report.itemEvaluated || [];
            const totalItems = itemsEvaluated.length || 0;
            const itemsChecked = itemsEvaluated.filter(item => 
                item.status === 'GOOD' || item.status === 'BAD' || item.status === 'FLAGGED'
            ).length || 0;
            
            const reportCompletion = totalItems > 0 ? (itemsChecked / totalItems) * 100 : 0;
            reporterStats[reporterId].completionRate = (
                (reporterStats[reporterId].completionRate * (reporterStats[reporterId].totalReports - 1) + reportCompletion) / 
                reporterStats[reporterId].totalReports
            );
        });

        const topPerformers = Object.values(reporterStats)
            .sort((a, b) => b.totalReports - a.totalReports)
            .slice(0, 3)
            .map((performer, index) => ({
                name: performer.reporter.name,
                class: performer.reporter.studentProfile?.class?.name || 'Unknown Class',
                reports: performer.totalReports,
                completion: Math.round(performer.completionRate)
            }));

        // Day details for modal
        const dayDetails = {};
        dailyBreakdown.forEach(day => {
            const dayReports = weeklyReports.filter(report => {
                const reportDay = new Date(report.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
                return reportDay === day.day;
            });

            const goodReports = dayReports.filter(report => {
                const itemsEvaluated = report.itemEvaluated || [];
                return itemsEvaluated.every(item => 
                    item.status === 'GOOD'
                ) && (report.status === 'APPROVED' || report.status === 'REVIEWED');
            });

            const badReports = dayReports.filter(report => {
                const itemsEvaluated = report.itemEvaluated || [];
                return itemsEvaluated.some(item => 
                    item.status === 'BAD'
                ) || report.status === 'REJECTED';
            });

            const flaggedReports = dayReports.filter(report => {
                const itemsEvaluated = report.itemEvaluated || [];
                return itemsEvaluated.some(item => 
                    item.status === 'FLAGGED'
                );
            });

            dayDetails[day.day] = {
                good: {
                    count: goodReports.length,
                    items: goodReports.slice(0, 5).map(report => ({
                        name: report.reporter.name,
                        class: report.reporter.studentProfile?.class?.name || 'Unknown Class'
                    }))
                },
                bad: {
                    count: badReports.length,
                    items: badReports.slice(0, 5).map(report => ({
                        name: report.reporter.name,
                        class: report.reporter.studentProfile?.class?.name || 'Unknown Class'
                    }))
                },
                flagged: {
                    count: flaggedReports.length,
                    items: flaggedReports.slice(0, 5).map(report => ({
                        name: report.reporter.name,
                        class: report.reporter.studentProfile?.class?.name || 'Unknown Class'
                    }))
                }
            };
        });

        // Format date range for display
        const displayDateRange = `${startOfWeek.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        })} - ${endOfWeek.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        })}`;

        return res.status(200).json({
            success: true,
            data: {
                weeklyStats: {
                    totalReports,
                    totalRepresentatives,
                    flaggedItems: flaggedReports.length,
                    resolvedIssues,
                    trend: Math.round(trend * 10) / 10
                },
                dailyBreakdown,
                topPerformers,
                dayDetails,
                dateRange: displayDateRange
            },
            message: "Weekly report data fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching weekly report:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};


export const getOrganizedReport = async (req, res) => {
    try {
        const { search = '' } = req.query;

        // Get all reports grouped by weeks
        const allReports = await prisma.report.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // Last 60 days
                }
            },
            include: {
                reporter: {
                    include: {
                        studentProfile: {
                            include: {
                                class: true
                            }
                        }
                    }
                },
                class: true,
                approvals: true,
                reviews: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Group reports by week
        const weeksMap = new Map();
        
        allReports.forEach(report => {
            const reportDate = new Date(report.createdAt);
            const weekStart = getWeekStartDate(reportDate);
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeksMap.has(weekKey)) {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                weeksMap.set(weekKey, {
                    weekStart,
                    weekEnd,
                    reports: [],
                    weekNumber: getWeekNumber(weekStart)
                });
            }
            
            weeksMap.get(weekKey).reports.push(report);
        });

        // Calculate statistics for each week
        const weeksData = Array.from(weeksMap.values())
            .sort((a, b) => b.weekStart - a.weekStart)
            .map((week, index) => {
                const reports = week.reports;
                const totalReports = reports.length;
                
                const approved = reports.filter(report => 
                    report.status === 'APPROVED' || report.status === 'REVIEWED'
                ).length;
                
                const pending = reports.filter(report => 
                    report.status === 'SUBMITTED' || report.status === 'UNDER_REVIEW' || report.status === 'PARTIAL'
                ).length;
                
                const flagged = reports.filter(report => {
                    const itemsEvaluated = report.itemEvaluated || [];
                    return itemsEvaluated.some(item => 
                        item.status === 'BAD' || item.status === 'FLAGGED'
                    ) || report.status === 'REJECTED';
                }).length;
                
                const uniqueReporterIds = [...new Set(reports.map(report => report.reporterId))];
                const representatives = uniqueReporterIds.length;

                return {
                    weekNumber: week.weekNumber,
                    startDate: week.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    endDate: week.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    totalReports,
                    approved,
                    pending,
                    flagged,
                    representatives,
                    rawStartDate: week.weekStart,
                    rawEndDate: week.weekEnd
                };
            });

        // Calculate total statistics
        const totalStats = {
            weeks: weeksData.length,
            totalReports: weeksData.reduce((sum, w) => sum + w.totalReports, 0),
            avgReports: Math.round(weeksData.reduce((sum, w) => sum + w.totalReports, 0) / weeksData.length) || 0,
            totalFlagged: weeksData.reduce((sum, w) => sum + w.flagged, 0)
        };

        // Filter by search term if provided
        let filteredWeeks = weeksData;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredWeeks = weeksData.filter(week =>
                week.startDate.toLowerCase().includes(searchLower) ||
                week.endDate.toLowerCase().includes(searchLower) ||
                `week ${week.weekNumber}`.toLowerCase().includes(searchLower)
            );
        }

        return res.status(200).json({
            success: true,
            data: {
                weeks: filteredWeeks,
                totalStats,
                totalWeeks: weeksData.length
            },
            message: "Organized reports data fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching organized reports:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// Helper function to get week start date (Monday)
function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
}

// Helper function to get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}


export const getRepresentatives = async (req, res) => {
    try {
        const { search = '', department = 'all' } = req.query;

        // Get all students with representative roles (CS, CP, CC, WS)
        const representatives = await prisma.student.findMany({
            where: {
                studentRole: {
                    in: ['CS', 'CP', 'CC', 'WS']
                },
                user: {
                    status: 'ACTIVE'
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        status: true,
                        createdAt: true
                    }
                },
                class: true
            },
            orderBy: {
                user: {
                    name: 'asc'
                }
            }
        });

        // Get report statistics for each representative
        const representativesWithStats = await Promise.all(
            representatives.map(async (rep) => {
                // Get reports submitted by this representative
                const reports = await prisma.report.findMany({
                    where: {
                        reporterId: rep.user.id
                    },
                    include: {
                        approvals: true,
                        reviews: true
                    }
                });

                // Calculate statistics
                const reportsSubmitted = reports.length;
                
                // Calculate average completion rate
                let totalCompletion = 0;
                reports.forEach(report => {
                    const itemsEvaluated = report.itemEvaluated || [];
                    const totalItems = itemsEvaluated.length || 0;
                    const itemsChecked = itemsEvaluated.filter(item => 
                        item.status === 'GOOD' || item.status === 'BAD' || item.status === 'FLAGGED'
                    ).length || 0;
                    
                    const completionRate = totalItems > 0 ? (itemsChecked / totalItems) * 100 : 0;
                    totalCompletion += completionRate;
                });

                const avgCompletionRate = reportsSubmitted > 0 ? 
                    Math.round(totalCompletion / reportsSubmitted) : 0;

                // Determine department from class name
                const department = rep.class?.name?.split(' ')[0] || 'General';

                return {
                    id: rep.user.id,
                    name: rep.user.name,
                    email: rep.user.email,
                    phone: rep.user.phone,
                    class: rep.class?.name || 'Not Assigned',
                    department: department,
                    reportsSubmitted: reportsSubmitted,
                    avgCompletionRate: avgCompletionRate,
                    status: rep.user.status.toLowerCase(),
                    studentRole: rep.studentRole,
                    createdAt: rep.user.createdAt
                };
            })
        );

        // Filter based on search and department
        let filteredReps = representativesWithStats;
        
        if (department !== 'all') {
            filteredReps = filteredReps.filter(rep => 
                rep.department.toLowerCase() === department.toLowerCase()
            );
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredReps = filteredReps.filter(rep =>
                rep.name.toLowerCase().includes(searchLower) ||
                rep.email.toLowerCase().includes(searchLower) ||
                rep.class.toLowerCase().includes(searchLower)
            );
        }

        // Get unique departments for filter
        const departments = ['all', ...new Set(representativesWithStats.map(rep => rep.department))];

        // Calculate overall statistics
        const totalReps = representativesWithStats.length;
        const activeReps = representativesWithStats.filter(rep => rep.status === 'active').length;
        const totalDepartments = departments.length - 1;

        return res.status(200).json({
            success: true,
            data: {
                representatives: filteredReps,
                stats: {
                    total: totalReps,
                    active: activeReps,
                    departments: totalDepartments
                },
                departments: departments,
                filters: {
                    search,
                    department
                }
            },
            message: "Representatives data fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching representatives:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};





export const getWeekReports = async (req, res) => {
    try {
        const { week, startDate, endDate } = req.query;

        // If startDate and endDate are provided, use them directly
        let weekStart, weekEnd;
        
        if (startDate && endDate) {
            weekStart = new Date(startDate);
            weekEnd = new Date(endDate);
        } else {
            // Calculate week range from week number
            const weekNum = parseInt(week) || 44;
            weekStart = getDateFromWeekNumber(weekNum, 2024);
            weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
        }

        // Ensure proper time boundaries
        weekStart.setHours(0, 0, 0, 0);
        weekEnd.setHours(23, 59, 59, 999);

        // Get reports for the specified week
        const weekReports = await prisma.report.findMany({
            where: {
                createdAt: {
                    gte: weekStart,
                    lte: weekEnd
                }
            },
            include: {
                reporter: {
                    include: {
                        studentProfile: {
                            include: {
                                class: true
                            }
                        }
                    }
                },
                class: true,
                approvals: {
                    include: {
                        csStudent: true,
                        cpStudent: true
                    }
                },
                reviews: {
                    include: {
                        admin: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Transform data to match frontend format
        const transformedReports = weekReports.map(report => {
            // Map backend status to frontend status
            let status = 'pending';
            if (report.status === 'APPROVED' || report.status === 'REVIEWED') {
                status = 'approved';
            } else if (report.status === 'REJECTED') {
                status = 'rejected';
            }

            // Parse itemEvaluated JSON
            const itemsEvaluated = report.itemEvaluated || [];
            const items = itemsEvaluated.map((item, index) => ({
                name: item.name || `Item ${index + 1}`,
                status: (item.status || 'good').toLowerCase(),
                comment: item.comment || ''
            }));

            // Ensure we have at least some items for display
            const defaultItems = [
                { name: 'Fire Extinguisher', status: 'good', comment: '' },
                { name: 'Emergency Exit Signs', status: 'good', comment: '' },
                { name: 'Window Glass', status: 'good', comment: '' },
                { name: 'Floor Condition', status: 'good', comment: '' },
                { name: 'Electrical Outlets', status: 'good', comment: '' },
                { name: 'First Aid Kit', status: 'good', comment: '' },
                { name: 'Chemical Storage', status: 'good', comment: '' },
                { name: 'Ventilation System', status: 'good', comment: '' },
                { name: 'Safety Equipment', status: 'good', comment: '' },
                { name: 'Lighting', status: 'good', comment: '' }
            ];

            // Use actual items if available, otherwise use defaults
            const displayItems = items.length > 0 ? items : defaultItems;

            // Format dates
            const date = report.createdAt.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const time = report.createdAt.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });

            return {
                id: report.id,
                title: report.title,
                representative: report.reporter.name,
                class: report.class.name,
                status: status,
                date: date,
                time: time,
                items: displayItems,
                rawData: {
                    generalComment: report.generalComment,
                    approvals: report.approvals,
                    reviews: report.reviews,
                    createdAt: report.createdAt
                }
            };
        });

        // Calculate statistics
        const stats = {
            total: weekReports.length,
            approved: weekReports.filter(r => 
                r.status === 'APPROVED' || r.status === 'REVIEWED'
            ).length,
            pending: weekReports.filter(r => 
                r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW' || r.status === 'PARTIAL'
            ).length,
            rejected: weekReports.filter(r => r.status === 'REJECTED').length
        };

        return res.status(200).json({
            success: true,
            data: {
                reports: transformedReports,
                stats: stats,
                weekInfo: {
                    weekNumber: week,
                    startDate: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    endDate: weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    totalReports: weekReports.length
                }
            },
            message: `Week ${week} reports fetched successfully`
        });

    } catch (error) {
        console.error('Error fetching week reports:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// Helper function to get date from week number
function getDateFromWeekNumber(weekNumber, year) {
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dayOfWeek = simple.getDay();
    const weekStart = simple;
    if (dayOfWeek <= 4) {
        weekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        weekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return weekStart;
}







export const getClasses = async (req, res) => {
    try {
        const { search = '' } = req.query;

        // Get all classes with their students and reports
        const classes = await prisma.class.findMany({
            include: {
                students: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                status: true
                            }
                        }
                    }
                },
                reports: {
                    where: {
                        createdAt: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                        }
                    },
                    include: {
                        reporter: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Transform data to include statistics
        const classesWithStats = classes.map(cls => {
            const totalStudents = cls.students.length;
            
            // Count representatives (students with specific roles)
            const representatives = cls.students.filter(student => 
                student.studentRole && ['CS', 'CP', 'CC', 'WS'].includes(student.studentRole)
            ).length;
            
            const reportsThisWeek = cls.reports.length;

            // Extract department from class name or use default
            const department = extractDepartmentFromClassName(cls.name);
            
            // Extract year from class name or use default
            const year = extractYearFromClassName(cls.name);

            // Generate room location based on department
            const room = generateRoomLocation(cls.name, cls.id, department);

            return {
                id: cls.id,
                name: cls.name,
                description: cls.description,
                department: department,
                year: year,
                totalStudents: totalStudents,
                representatives: representatives,
                reportsThisWeek: reportsThisWeek,
                room: room,
                status: 'active', // Default status since it's not in the model
                createdAt: cls.createdAt,
                updatedAt: cls.updatedAt,
                // Additional data for details
                studentList: cls.students.map(student => ({
                    id: student.user.id,
                    name: student.user.name,
                    email: student.user.email,
                    status: student.user.status,
                    role: student.studentRole
                })),
                recentReports: cls.reports.map(report => ({
                    id: report.id,
                    title: report.title,
                    reporter: report.reporter.name,
                    status: report.status,
                    createdAt: report.createdAt
                }))
            };
        });

        // Filter based on search term
        let filteredClasses = classesWithStats;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredClasses = classesWithStats.filter(cls =>
                cls.name.toLowerCase().includes(searchLower) ||
                cls.department.toLowerCase().includes(searchLower) ||
                cls.room.toLowerCase().includes(searchLower) ||
                cls.description?.toLowerCase().includes(searchLower)
            );
        }

        // Calculate overall statistics
        const stats = {
            totalClasses: classesWithStats.length,
            totalStudents: classesWithStats.reduce((sum, cls) => sum + cls.totalStudents, 0),
            totalRepresentatives: classesWithStats.reduce((sum, cls) => sum + cls.representatives, 0),
            reportsThisWeek: classesWithStats.reduce((sum, cls) => sum + cls.reportsThisWeek, 0)
        };

        return res.status(200).json({
            success: true,
            data: {
                classes: filteredClasses,
                stats: stats,
                filters: {
                    search
                }
            },
            message: "Classes data fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching classes:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// Helper function to extract department from class name
function extractDepartmentFromClassName(className) {
    const departmentMap = {
        'computer': 'Computer Science',
        'cs': 'Computer Science',
        'engineering': 'Engineering',
        'eng': 'Engineering',
        'chemistry': 'Chemistry',
        'chem': 'Chemistry',
        'physics': 'Physics',
        'phys': 'Physics',
        'mathematics': 'Mathematics',
        'math': 'Mathematics',
        'business': 'Business',
        'bio': 'Biology',
        'biology': 'Biology'
    };

    const lowerName = className.toLowerCase();
    
    for (const [key, department] of Object.entries(departmentMap)) {
        if (lowerName.includes(key)) {
            return department;
        }
    }
    
    // If no match found, extract first word or return general department
    const firstWord = className.split(' ')[0];
    return firstWord || 'General';
}

// Helper function to extract year from class name
function extractYearFromClassName(className) {
    const yearMatch = className.match(/(\d)/);
    return yearMatch ? parseInt(yearMatch[1]) : 1;
}

// Helper function to generate room location
function generateRoomLocation(className, classId, department) {
    const buildingMap = {
        'Computer Science': 'Building A',
        'Engineering': 'Building B',
        'Science': 'Building C',
        'Chemistry': 'Building C',
        'Physics': 'Building C',
        'Mathematics': 'Building A',
        'Business': 'Building D',
        'Biology': 'Building E'
    };

    const building = buildingMap[department] || 'Building F';
    const roomType = className.toLowerCase().includes('lab') ? 'Lab' : 'Room';
    const roomNumber = `${classId.toString().padStart(3, '0')}`;
    
    return `${building} - ${roomType} ${roomNumber}`;
}

// Additional API for class details
export const getClassDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const classDetails = await prisma.class.findUnique({
            where: { id },
            include: {
                students: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                status: true
                            }
                        }
                    },
                    orderBy: {
                        user: {
                            name: 'asc'
                        }
                    }
                },
                reports: {
                    include: {
                        reporter: {
                            select: {
                                name: true,
                                email: true
                            }
                        },
                        approvals: {
                            include: {
                                csStudent: {
                                    select: { name: true }
                                },
                                cpStudent: {
                                    select: { name: true }
                                }
                            }
                        },
                        reviews: {
                            include: {
                                admin: {
                                    select: { name: true }
                                }
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 20 // Last 20 reports
                }
            }
        });

        if (!classDetails) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        // Calculate statistics
        const totalStudents = classDetails.students.length;
        const activeStudents = classDetails.students.filter(s => s.user.status === 'ACTIVE').length;
        const representatives = classDetails.students.filter(s => 
            s.studentRole && ['CS', 'CP', 'CC', 'WS'].includes(s.studentRole)
        ).length;

        // Recent activity (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentReports = classDetails.reports.filter(r => 
            new Date(r.createdAt) >= thirtyDaysAgo
        ).length;

        const department = extractDepartmentFromClassName(classDetails.name);
        const year = extractYearFromClassName(classDetails.name);
        const room = generateRoomLocation(classDetails.name, classDetails.id, department);

        return res.status(200).json({
            success: true,
            data: {
                class: {
                    id: classDetails.id,
                    name: classDetails.name,
                    description: classDetails.description,
                    department: department,
                    year: year,
                    room: room,
                    createdAt: classDetails.createdAt,
                    updatedAt: classDetails.updatedAt
                },
                statistics: {
                    totalStudents,
                    activeStudents,
                    representatives,
                    recentReports,
                    totalReports: classDetails.reports.length
                },
                students: classDetails.students.map(student => ({
                    id: student.user.id,
                    name: student.user.name,
                    email: student.user.email,
                    phone: student.user.phone,
                    status: student.user.status,
                    role: student.studentRole,
                    isRepresentative: student.studentRole && ['CS', 'CP', 'CC', 'WS'].includes(student.studentRole)
                })),
                recentReports: classDetails.reports.map(report => ({
                    id: report.id,
                    title: report.title,
                    reporter: report.reporter.name,
                    reporterEmail: report.reporter.email,
                    status: report.status,
                    createdAt: report.createdAt,
                    approvals: report.approvals ? {
                        csApproved: report.approvals.approvedByCS,
                        cpApproved: report.approvals.approvedByCP,
                        csStudent: report.approvals.csStudent?.name,
                        cpStudent: report.approvals.cpStudent?.name
                    } : null,
                    reviews: report.reviews.map(review => ({
                        admin: review.admin?.name,
                        status: review.status,
                        comments: review.comments
                    }))
                }))
            },
            message: "Class details fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching class details:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// API to create a new class
export const createClass = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Class name is required"
            });
        }

        // Check if class already exists
        const existingClass = await prisma.class.findUnique({
            where: { name }
        });

        if (existingClass) {
            return res.status(400).json({
                success: false,
                message: "Class with this name already exists"
            });
        }

        const newClass = await prisma.class.create({
            data: {
                name,
                description
            }
        });

        return res.status(201).json({
            success: true,
            data: {
                class: newClass
            },
            message: "Class created successfully"
        });

    } catch (error) {
        console.error('Error creating class:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// API to update a class
export const updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updatedClass = await prisma.class.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description && { description })
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                class: updatedClass
            },
            message: "Class updated successfully"
        });

    } catch (error) {
        console.error('Error updating class:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// API to delete a class
export const deleteClass = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if class has students or reports
        const classWithRelations = await prisma.class.findUnique({
            where: { id },
            include: {
                students: true,
                reports: true
            }
        });

        if (!classWithRelations) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        if (classWithRelations.students.length > 0 || classWithRelations.reports.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete class with existing students or reports. Please reassign or remove them first."
            });
        }

        await prisma.class.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: "Class deleted successfully"
        });

    } catch (error) {
        console.error('Error deleting class:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};












export const getInspectionItems = async (req, res) => {
    try {
        const { search = '', category = 'all' } = req.query;

        // Get all inspection items from the database
        const items = await prisma.item.findMany({
            orderBy: {
                name: 'asc'
            }
        });

        // Get usage statistics from reports
        const reports = await prisma.report.findMany({
            select: {
                itemEvaluated: true
            }
        });

        // Process all reports to calculate usage statistics for each item
        const itemUsageMap = new Map();

        // Initialize all items in the map
        items.forEach(item => {
            itemUsageMap.set(item.id, {
                usageCount: 0,
                goodCount: 0,
                badCount: 0,
                flaggedCount: 0
            });
        });

        // Process each report to count item evaluations
        reports.forEach(report => {
            const itemEvaluated = report.itemEvaluated || [];
            
            itemEvaluated.forEach(evaluation => {
                const itemId = evaluation.itemId;
                const status = evaluation.status?.toUpperCase();
                
                if (itemUsageMap.has(itemId)) {
                    const stats = itemUsageMap.get(itemId);
                    stats.usageCount++;
                    
                    switch (status) {
                        case 'GOOD':
                            stats.goodCount++;
                            break;
                        case 'BAD':
                            stats.badCount++;
                            break;
                        case 'FLAGGED':
                            stats.flaggedCount++;
                            break;
                    }
                    
                    itemUsageMap.set(itemId, stats);
                }
            });
        });

        // Combine item data with usage statistics
        const itemsWithStats = items.map(item => {
            const usageStats = itemUsageMap.get(item.id) || {
                usageCount: 0,
                goodCount: 0,
                badCount: 0,
                flaggedCount: 0
            };

            // Extract category from description or use default
            const category = extractCategoryFromItem(item.name, item.description);
            
            // Determine if item is mandatory (you might want to add this field to the Item model)
            const mandatory = isItemMandatory(item.name);

            return {
                id: item.id,
                name: item.name,
                description: item.description,
                category: category,
                mandatory: mandatory,
                usageCount: usageStats.usageCount,
                goodCount: usageStats.goodCount,
                badCount: usageStats.badCount,
                flaggedCount: usageStats.flaggedCount,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            };
        });

        // Filter based on search term and category
        let filteredItems = itemsWithStats;
        
        if (category !== 'all') {
            filteredItems = filteredItems.filter(item => 
                item.category.toLowerCase() === category.toLowerCase()
            );
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredItems = filteredItems.filter(item =>
                item.name.toLowerCase().includes(searchLower) ||
                item.description.toLowerCase().includes(searchLower) ||
                item.category.toLowerCase().includes(searchLower)
            );
        }

        // Calculate overall statistics
        const stats = {
            totalItems: itemsWithStats.length,
            mandatory: itemsWithStats.filter(i => i.mandatory).length,
            totalUsage: itemsWithStats.reduce((sum, i) => sum + i.usageCount, 0),
            avgGoodRate: itemsWithStats.length > 0 ? 
                Math.round(itemsWithStats.reduce((sum, i) => sum + (i.usageCount > 0 ? (i.goodCount / i.usageCount * 100) : 0), 0) / itemsWithStats.length) : 0
        };

        // Get unique categories for filter
        const categories = ['all', ...new Set(itemsWithStats.map(item => item.category))];

        return res.status(200).json({
            success: true,
            data: {
                items: filteredItems,
                stats: stats,
                categories: categories,
                filters: {
                    search,
                    category
                }
            },
            message: "Inspection items fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching inspection items:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// Helper function to extract category from item name and description
function extractCategoryFromItem(name, description) {
    const categoryKeywords = {
        'Safety Equipment': ['fire', 'extinguisher', 'emergency', 'exit', 'safety', 'first aid', 'chemical', 'goggles', 'gloves'],
        'Infrastructure': ['window', 'glass', 'floor', 'wall', 'ceiling', 'door', 'building'],
        'Electrical': ['electrical', 'outlet', 'lighting', 'light', 'wiring', 'socket', 'power'],
        'HVAC': ['ventilation', 'air conditioning', 'heating', 'hvac', 'fan', 'vent'],
        'Furniture': ['desk', 'chair', 'table', 'furniture', 'cabinet', 'shelf'],
        'Equipment': ['equipment', 'machine', 'tool', 'device', 'instrument']
    };

    const searchText = `${name} ${description}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => searchText.includes(keyword))) {
            return category;
        }
    }
    
    return 'General';
}

// Helper function to determine if item is mandatory
function isItemMandatory(itemName) {
    const mandatoryItems = [
        'fire extinguisher',
        'emergency exit',
        'first aid',
        'electrical',
        'lighting',
        'ventilation'
    ];
    
    return mandatoryItems.some(mandatoryItem => 
        itemName.toLowerCase().includes(mandatoryItem)
    );
}

// API to get item details
export const getItemDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await prisma.item.findUnique({
            where: { id }
        });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        // Get detailed usage statistics
        const reportsWithItem = await prisma.report.findMany({
            where: {
                itemEvaluated: {
                    path: '$[*].itemId',
                    array_contains: id
                }
            },
            include: {
                reporter: {
                    select: {
                        name: true
                    }
                },
                class: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50 // Last 50 reports containing this item
        });

        // Calculate detailed statistics
        let usageCount = 0;
        let goodCount = 0;
        let badCount = 0;
        let flaggedCount = 0;
        const recentEvaluations = [];

        reportsWithItem.forEach(report => {
            const itemEvaluated = report.itemEvaluated || [];
            const evaluation = itemEvaluated.find(evalItem => evalItem.itemId === id);
            
            if (evaluation) {
                usageCount++;
                const status = evaluation.status?.toUpperCase();
                
                switch (status) {
                    case 'GOOD':
                        goodCount++;
                        break;
                    case 'BAD':
                        badCount++;
                        break;
                    case 'FLAGGED':
                        flaggedCount++;
                        break;
                }

                // Add to recent evaluations
                if (recentEvaluations.length < 10) {
                    recentEvaluations.push({
                        reportId: report.id,
                        reportTitle: report.title,
                        reporter: report.reporter.name,
                        class: report.class.name,
                        status: status,
                        comment: evaluation.comment,
                        evaluatedAt: report.createdAt
                    });
                }
            }
        });

        const category = extractCategoryFromItem(item.name, item.description);
        const mandatory = isItemMandatory(item.name);

        return res.status(200).json({
            success: true,
            data: {
                item: {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    category: category,
                    mandatory: mandatory,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                },
                statistics: {
                    usageCount,
                    goodCount,
                    badCount,
                    flaggedCount,
                    goodRate: usageCount > 0 ? Math.round((goodCount / usageCount) * 100) : 0,
                    badRate: usageCount > 0 ? Math.round((badCount / usageCount) * 100) : 0,
                    flaggedRate: usageCount > 0 ? Math.round((flaggedCount / usageCount) * 100) : 0
                },
                recentEvaluations,
                totalReports: reportsWithItem.length
            },
            message: "Item details fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching item details:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// API to create a new inspection item
export const createItem = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Item name is required"
            });
        }

        // Check if item already exists
        const existingItem = await prisma.item.findUnique({
            where: { name }
        });

        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: "Item with this name already exists"
            });
        }

        const newItem = await prisma.item.create({
            data: {
                name,
                description
            }
        });

        return res.status(201).json({
            success: true,
            data: {
                item: newItem
            },
            message: "Inspection item created successfully"
        });

    } catch (error) {
        console.error('Error creating item:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// API to update an inspection item
export const updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        // Check if name is being updated and if it conflicts with existing item
        if (name) {
            const existingItem = await prisma.item.findFirst({
                where: {
                    name,
                    NOT: { id }
                }
            });

            if (existingItem) {
                return res.status(400).json({
                    success: false,
                    message: "Another item with this name already exists"
                });
            }
        }

        const updatedItem = await prisma.item.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description && { description })
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                item: updatedItem
            },
            message: "Item updated successfully"
        });

    } catch (error) {
        console.error('Error updating item:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// API to delete an inspection item
export const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if item is used in any reports
        const reportsWithItem = await prisma.report.findMany({
            where: {
                itemEvaluated: {
                    path: '$[*].itemId',
                    array_contains: id
                }
            },
            take: 1
        });

        if (reportsWithItem.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete item that is used in reports. Please remove it from all reports first."
            });
        }

        await prisma.item.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: "Item deleted successfully"
        });

    } catch (error) {
        console.error('Error deleting item:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// API to get item usage trends
export const getItemTrends = async (req, res) => {
    try {
        const { id } = req.params;
        const { period = '30d' } = req.query; // 7d, 30d, 90d

        const days = parseInt(period) || 30;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const reports = await prisma.report.findMany({
            where: {
                createdAt: {
                    gte: startDate
                },
                itemEvaluated: {
                    path: '$[*].itemId',
                    array_contains: id
                }
            },
            select: {
                createdAt: true,
                itemEvaluated: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Group by day and calculate daily statistics
        const dailyStats = {};
        
        reports.forEach(report => {
            const date = report.createdAt.toISOString().split('T')[0];
            if (!dailyStats[date]) {
                dailyStats[date] = { usage: 0, good: 0, bad: 0, flagged: 0 };
            }
            
            const evaluation = report.itemEvaluated.find(evalItem => evalItem.itemId === id);
            if (evaluation) {
                dailyStats[date].usage++;
                const status = evaluation.status?.toUpperCase();
                
                switch (status) {
                    case 'GOOD':
                        dailyStats[date].good++;
                        break;
                    case 'BAD':
                        dailyStats[date].bad++;
                        break;
                    case 'FLAGGED':
                        dailyStats[date].flagged++;
                        break;
                }
            }
        });

        // Convert to array format for charts
        const trends = Object.entries(dailyStats).map(([date, stats]) => ({
            date,
            ...stats,
            goodRate: stats.usage > 0 ? Math.round((stats.good / stats.usage) * 100) : 0
        }));

        return res.status(200).json({
            success: true,
            data: {
                trends,
                period: `${days}d`
            },
            message: "Item trends fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching item trends:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};















export const getAdminProfile = async (req, res) => {
    try {
        // Get admin ID from authenticated user (from JWT token or session)
        const adminId = req.user.id;

        // Fetch admin profile with user details
        const adminProfile = await prisma.admin.findUnique({
            where: { userId: adminId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        });

        if (!adminProfile) {
            return res.status(404).json({
                success: false,
                message: "Admin profile not found"
            });
        }

        // Parse name into first and last name
        const nameParts = adminProfile.user.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Calculate admin statistics
        const totalReports = await prisma.report.count();
        const totalStudents = await prisma.user.count({
            where: {
                role: 'STUDENT',
                status: 'ACTIVE'
            }
        });
        const totalRepresentatives = await prisma.student.count({
            where: {
                studentRole: {
                    in: ['CS', 'CP', 'CC', 'WS']
                },
                user: {
                    status: 'ACTIVE'
                }
            }
        });

        // Calculate system uptime (this would typically come from system monitoring)
        // For demo purposes, we'll use a fixed value
        const systemUptime = '99.9%';

        // Format join date
        const joinDate = adminProfile.user.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
        });

        // Generate admin ID
        const adminIdFormatted = `ADM-${adminProfile.user.createdAt.getFullYear()}-${adminProfile.id.slice(-3).toUpperCase()}`;

        return res.status(200).json({
            success: true,
            data: {
                profile: {
                    id: adminProfile.id,
                    userId: adminProfile.userId,
                    firstName: firstName,
                    lastName: lastName,
                    email: adminProfile.user.email,
                    phone: adminProfile.user.phone || '+1 (555) 000-0000',
                    address: adminProfile.user.address || 'Not specified',
                    role: 'System Administrator', // You might want to store this in the Admin model
                    department: adminProfile.department || 'Administration',
                    adminId: adminIdFormatted,
                    joinDate: joinDate,
                    permissions: adminProfile.permissions || [],
                    createdAt: adminProfile.user.createdAt,
                    updatedAt: adminProfile.user.updatedAt
                },
                statistics: {
                    totalReports: totalReports,
                    activeStudents: totalStudents,
                    representatives: totalRepresentatives,
                    systemUptime: systemUptime
                }
            },
            message: "Admin profile fetched successfully"
        });

    } catch (error) {
        console.error('Error fetching admin profile:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

export const updateAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { firstName, lastName, email, phone, address } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: "First name, last name, and email are required"
            });
        }

        // Check if email is already taken by another user
        const existingUser = await prisma.user.findFirst({
            where: {
                email: email,
                id: { not: adminId }
            }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email is already taken by another user"
            });
        }

        // Update user information
        const fullName = `${firstName} ${lastName}`.trim();
        
        const updatedUser = await prisma.user.update({
            where: { id: adminId },
            data: {
                name: fullName,
                email: email,
                phone: phone,
                address: address,
                updatedAt: new Date()
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                profile: {
                    firstName: firstName,
                    lastName: lastName,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    address: updatedUser.address,
                    updatedAt: updatedUser.updatedAt
                }
            },
            message: "Profile updated successfully"
        });

    } catch (error) {
        console.error('Error updating admin profile:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

export const changeAdminPassword = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All password fields are required"
            });
        }

        // Check if new passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New passwords do not match"
            });
        }

        // Check password length
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters long"
            });
        }

        // Get current user to verify current password
        const currentUser = await prisma.user.findUnique({
            where: { id: adminId },
            select: { password: true }
        });

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password (you'll need to implement password verification)
        // For now, we'll assume you have a function to verify passwords
        const isCurrentPasswordValid = await verifyPassword(currentPassword, currentUser.password);
        
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Hash new password
        const hashedNewPassword = await hashPassword(newPassword);

        // Update password
        await prisma.user.update({
            where: { id: adminId },
            data: {
                password: hashedNewPassword,
                updatedAt: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (error) {
        console.error('Error changing admin password:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again."
        });
    }
};

// Helper function to verify password (you'll need to implement this based on your auth system)
async function verifyPassword(plainPassword, hashedPassword) {
    // Implement your password verification logic here
    // This is a placeholder - use bcrypt or your preferred hashing library
    return true; // Replace with actual verification
}

// Helper function to hash password (you'll need to implement this based on your auth system)
async function hashPassword(password) {
    // Implement your password hashing logic here
    // This is a placeholder - use bcrypt or your preferred hashing library
    return password; // Replace with actual hashing
}