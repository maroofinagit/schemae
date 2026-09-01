'use server';
import { db } from "@/app/lib/db";
import { auth } from "../lib/auth";
import { headers } from "next/headers";
import { cacheLife, updateTag, cacheTag, revalidatePath } from "next/cache";
import { Resend } from "resend";
import { NotificationType } from "@/generated/prisma/enums";

const resend = new Resend(process.env.RESEND_API_KEY);

// ===============================
// Cache Tags
// ===============================

// exams
// Global cache for all exams (full list / short list)

// exam-${examId}
// Cache for a single exam

// userExams-${userId}
// Cache for all exams enrolled by a user

// roadmap-${userExamId}-user-${userId}
// Cache for a roadmap of a specific user exam

// tests-${userExamId}
// Cache for tests belonging to a specific user exam

// userDashboard-${userId}
// Cache for a user's dashboard

// todaysTasks-${userId}
// Cache for today's tasks of a user

// profileData-${userId}
// Cache for a user's profile data including settings, etc.

// notifications-${userId}
// Cache for a user's notifications

export async function getFullExams() {
    'use cache';
    cacheTag('exams');
    cacheLife('hours'); // Cache for 30 seconds
    try {
        const exams = await db.exam.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
                aiContext: true,
                subjects: {
                    select: {
                        id: true,
                        name: true,
                        topics: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                difficulty: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                userExams: { _count: "asc" }
            }
        });

        return exams;
    } catch (error) {
        console.error("Error fetching exams:", error);
        return [];
    }
}

export async function getUserExam(id: number) {

    'use cache';
    cacheTag(`userExam-${id}`);
    cacheLife('hours'); // Cache for 30 seconds

    try {
        const userExam = await db.userExam.findFirst({
            where: {
                id: id,
            },
            select: {
                id: true,
            },
        });

        return userExam;
    } catch (error) {
        console.error("Error fetching user exam:", error);
        return null;
    }
}

export async function getExamById(id: number) {
    'use cache';
    cacheTag(`exam-${id}`);
    cacheLife('hours'); // Cache for 30 seconds
    try {
        const exam = await db.exam.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                aiContext: true,
                subjects: {
                    select: {
                        id: true,
                        name: true,
                        topics: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                difficulty: true,
                            },
                        },
                    },
                },
            },
        });

        return exam;
    } catch (err) {
        console.error("❌ Error fetching exam:", err);
        return null;
    }
};

export async function getShortExams() {
    'use cache';
    cacheTag('exams');
    cacheLife('hours'); // Cache for 30 seconds
    try {
        const exams = await db.exam.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
            },
        });

        return exams;
    } catch (error) {
        console.error("Error fetching exams:", error);
        return [];
    }
};

export async function getUserExams(userId: string) {
    'use cache';
    cacheTag(`userExams-${userId}`);
    cacheLife('hours');
    try {
        const userExams = await db.userExam.findMany({
            where: { user_id: userId },
            include: {
                exam: true
            },
        });

        return userExams;
    } catch (err) {
        console.error("❌ Error fetching UserExams:", err);
        return [];
    }
}

interface CreateUserExamProps {
    examId: number;
    start_date: string;
    end_date: string;
}

export async function createUserExam({
    examId,
    start_date,
    end_date,
}: CreateUserExamProps) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return {
                success: false,
                message: "Not authenticated",
            };
        }

        if (!examId || !start_date || !end_date) {
            return {
                success: false,
                message: "Missing required fields",
            };
        }

        const userId = session.user.id;

        const existingUserExam = await db.userExam.findFirst({
            where: {
                user_id: userId,
                exam_id: Number(examId),
            },
        });

        if (existingUserExam) {
            return {
                success: true,
                message: "UserExam already exists",
                user_exam_id: existingUserExam.id,
            };
        }

        const userExam = await db.userExam.create({
            data: {
                user_id: userId,
                exam_id: Number(examId),
                start_date: new Date(start_date),
                end_date: new Date(end_date),
                progress_percent: 0,
            },
        });

        updateTag(`userExams-${userId}`); // Invalidate the cache for the specific user exam
        updateTag(`userDashboard-${userId}`); // Invalidate the cache for the user's dashboard
        updateTag(`exam-${examId}`); // Invalidate the cache for the specific exam
        updateTag(`roadmap-${userExam.id}-user-${userId}`); // Invalidate the cache for the specific roadmap
        updateTag(`tests-${userExam.id}-user-${userId}`); // Invalidate the cache for the specific exam
        updateTag(`todaysTasks-${userId}`); // Invalidate the cache for today's tasks
        updateTag(`exams`); // Invalidate the cache for all exams
        updateTag(`userExam-${examId}`); // Invalidate the cache for the specific user exam
        updateTag(`profileData-${userId}`); // Invalidate the cache for the user's profile data

        return {
            success: true,
            user_exam_id: userExam.id,
        };
    } catch (error) {
        console.error("❌ Error creating UserExam:", error);

        return {
            success: false,
            message: "Internal server error",
        };
    }
}

export async function getCachedRoadmap(user_exam_id: number, userId: string) {

    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            throw new Error("User not authenticated");
        }


        if (session.user.id !== userId) {
            console.error("❌ User ID mismatch. Access denied.");
            throw new Error("Access denied");
        }

        const roadmap = await getRoadmap(user_exam_id, userId);
        if (!roadmap) {
            console.error("❌ Roadmap not found for user_exam_id:", user_exam_id);
            throw new Error("Roadmap not found");
        }
        return roadmap;
    }
    catch (error) {
        console.error("❌ Error validating session:", error);
        return null;
    }
}

export async function getRoadmap(user_exam_id: number, userId: string) {

    'use cache';
    cacheTag(`roadmap-${user_exam_id}-user-${userId}`);
    cacheLife('hours'); // Cache for 30 seconds

    try {
        const roadmap = await db.roadmap.findUnique({
            where: {
                user_exam_id,
                userExam: {
                    user_id: userId,
                }
            },

            select: {
                id: true,
                title: true,
                description: true,
                start_date: true,
                end_date: true,

                phases: {
                    orderBy: {
                        order_index: "asc",
                    },

                    select: {
                        id: true,
                        phase_name: true,
                        description: true,
                        start_date: true,
                        end_date: true,
                        progress: true,

                        weeks: {
                            orderBy: {
                                order_index: "asc",
                            },

                            select: {
                                id: true,
                                week_number: true,
                                focus: true,
                                start_date: true,
                                end_date: true,
                                progress: true,

                                tasks: {
                                    orderBy: {
                                        order_index: "asc",
                                    },

                                    select: {
                                        id: true,
                                        title: true,
                                        description: true,
                                        is_completed: true,
                                    },
                                },
                            },
                        },
                    },
                },

                milestones: {
                    orderBy: {
                        target_date: "asc",
                    },

                    select: {
                        id: true,
                        name: true,
                        goal: true,
                        achieved: true,
                        target_date: true,
                    },
                },

                userExam: {
                    select: {
                        id: true,
                        user_id: true,

                        exam: {
                            select: {
                                resources: {
                                    select: {
                                        id: true,
                                        title: true,
                                        type: true,
                                        url: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        return roadmap;
    } catch (err) {
        console.error("❌ Error fetching Roadmap:", err);
        return null;
    }
}

export type Roadmap = NonNullable<
    Awaited<ReturnType<typeof getRoadmap>>
>;


export async function getDashboardUser(userId: string) {

    'use cache';
    cacheTag(`userDashboard-${userId}`);
    cacheLife('hours'); // Cache for 30 seconds

    try {
        const dashboardUser = await db.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                image: true,
                exams: {
                    select: {
                        id: true,
                        progress_percent: true,
                        performanceScore: true,
                        roadmap_status: true,
                        highestScore: true,
                        lowestScore: true,
                        lastTestScore: true,

                        // UserExam → Exam Details
                        exam: {
                            select: {
                                name: true,
                            },

                        },

                        roadmap: {
                            select: {
                                // ⭐ Milestones added
                                milestones: {
                                    select: {
                                        id: true,
                                        name: true,
                                        goal: true,
                                        achieved: true,
                                        target_date: true,
                                    },
                                    orderBy: { target_date: "asc" }
                                },

                                // Phases, Weeks, Tasks
                                phases: {

                                    select: {
                                        phase_name: true,
                                        progress: true,

                                        weeks: {

                                            select: {
                                                week_number: true,
                                                progress: true,

                                            }
                                        }
                                    }
                                }
                            }
                        },

                        // UserExam → Test Performance Metrics
                        tests: {
                            orderBy: {
                                createdAt: "asc",
                            },
                            select: {
                                type: true,
                                createdAt: true,
                                isGenerated: true,

                                questions: {
                                    select: {
                                        id: true,
                                        correctAns: true,

                                        topic: {
                                            select: {
                                                id: true,
                                                name: true,

                                                tasks: {
                                                    select: {
                                                        id: true,
                                                        title: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },

                                attempt: {
                                    select: {
                                        percentage: true,
                                        isPassed: true,
                                        responses: true,
                                    },
                                },
                            },
                        },
                    },
                }
            }
        });

        return dashboardUser;
    }
    catch (err) {
        console.error("❌ Error fetching DashboardUser:", err);
        return null;
    }
};

export type DashboardUser = Awaited<
    ReturnType<typeof getDashboardUser>
>;

export async function getProfileSetting(userId: string) {

    'use cache';
    cacheTag(`profileSetting-${userId}`);
    cacheLife('hours'); // Cache for 30 seconds

    try {
        const userSettings = await db.user.findUnique({
            where: { id: userId },
            select: {
                soundEnabled: true,
                name: true,
            },
        });

        return userSettings;
    } catch (err) {
        console.error("❌ Error fetching Profile Settings:", err);
        return null;
    }
}


export async function deleteUserExam(user_exam_id: number, userId: string) {

    updateTag(`userDashboard-${userId}`); // Invalidate the cache for the user's dashboard
    updateTag(`roadmap-${user_exam_id}-user-${userId}`); // Invalidate the cache for the specific roadmap
    updateTag(`userExams-${userId}`); // Invalidate the cache for the specific user exam
    updateTag(`exam-${user_exam_id}`); // Invalidate the cache for the specific exam
    updateTag(`tests-${user_exam_id}-user-${userId}`); // Invalidate the cache for the specific exam
    updateTag(`todaysTasks-${userId}`); // Invalidate the cache for today's tasks
    updateTag(`exams`); // Invalidate the cache for all exams
    updateTag(`userExam-${user_exam_id}`); // Invalidate the cache for the specific user exam
    updateTag(`profileData-${userId}`); // Invalidate the cache for the user's profile data

    try {

        await db.userExam.delete({
            where: {
                id: user_exam_id,
            },
        });

        return {
            success: true,
            message: "User exam deleted successfully",
        };

    } catch (error) {

        console.error(
            "Error deleting user exam:",
            error
        );

        return {
            success: false,
            message: "Failed to delete user exam",
        };
    }
}

export async function markNotificationAsRead(notificationId: number) {

    try {
        const updatedNotification = await db.notification.update({
            where: { id: notificationId },
            data: { is_read: true },
        });

        updateTag(`profileData-${updatedNotification.user_id}`); // Invalidate the cache for the user's profile data
        updateTag(`notifications-${updatedNotification.user_id}`); // Invalidate the cache for the user's notifications

        return {
            success: true
        };
    } catch (error) {
        console.error("❌ Error marking notification as read:", error);
        return {
            success: false,
            message: "Failed to mark notification as read",
        };
    }
}


export async function completeRoadmapTask(taskId: number, user_exam_id: number, userId: string): Promise<{ success: boolean, notifications: string[], weekId?: number, phaseId?: number, weekProgress?: number, phaseProgress?: number }> {
    if (!taskId) {
        throw new Error("Task ID is required.");
    }

    const transStartTime = new Date().toISOString();

    try {

        const transaction = await db.$transaction(async (tx) => {

            // 1️⃣ Mark task as completed and fetch hierarchy
            const task = await tx.roadmapTask.update({
                where: { id: taskId },
                data: { is_completed: true },
                select: {
                    week_id: true,
                    week: {
                        select: {
                            week_number: true,
                            phase_id: true,
                            progress: true,
                            tasks: {
                                select: {
                                    is_completed: true,
                                }
                            },

                            phase: {
                                select: {
                                    id: true,
                                    phase_name: true,
                                    progress: true,

                                    weeks: {
                                        select: {
                                            id: true,
                                            progress: true,
                                        },
                                    },

                                    roadmap: {
                                        select: {
                                            id: true,
                                            user_exam_id: true,
                                            progress: true,
                                            userExam: {
                                                select: {
                                                    exam: {
                                                        select: {
                                                            name: true,
                                                        }
                                                    }
                                                }
                                            },
                                            phases: {
                                                select: {
                                                    id: true,
                                                    progress: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            const weekId = task.week_id;
            const weekNumber = task.week.week_number;
            const phaseId = task.week.phase_id;
            const phaseName = task.week.phase.phase_name;
            const roadmapId = task.week.phase.roadmap.id;
            const userExamId = task.week.phase.roadmap.user_exam_id;
            const userExamName = task.week.phase.roadmap.userExam.exam.name;

            // 2️⃣ Week Progress

            console.log('Week progress before update for weekId', weekId, ':', task.week.progress);

            const weekProgress = task.week.tasks.length
                ? Math.round(
                    (task.week.tasks.filter((t) => t.is_completed).length /
                        task.week.tasks.length) *
                    100
                )
                : 0;

            console.log("Week Progress Calculation:", weekProgress)

            await tx.roadmapWeek.update({
                where: { id: weekId },
                data: {
                    progress: weekProgress,
                },
            });

            console.log(`Phase progress before update for phaseId ${phaseId}:`, task.week.phase.progress);

            // 3️⃣ Phase Progress
            const phaseProgress = task.week.phase.weeks.length
                ? Math.round(
                    task.week.phase.weeks.reduce(
                        (sum, week) =>
                            sum +
                            (week.id === weekId
                                ? weekProgress
                                : week.progress),
                        0
                    ) / task.week.phase.weeks.length
                )
                : 0;

            console.log("Phase Progress Calculation:", phaseProgress)

            await tx.roadmapPhase.update({
                where: { id: phaseId },
                data: {
                    progress: phaseProgress,
                },
            });

            // 4️⃣ Roadmap Progress

            console.log(`Roadmap progress before update for roadmapId ${roadmapId}:`, task.week.phase.roadmap.progress);

            const roadmapProgress = task.week.phase.roadmap.phases.length
                ? Math.round(
                    task.week.phase.roadmap.phases.reduce((sum, phase) => sum + phase.progress, 0) /
                    task.week.phase.roadmap.phases.length
                )
                : 0;

            await tx.roadmap.update({
                where: { id: roadmapId },
                data: {
                    progress: roadmapProgress,
                },
            });

            // 5️⃣ User Exam Progress
            await tx.userExam.update({
                where: { id: userExamId },
                data: {
                    progress_percent: roadmapProgress,
                },
            });

            const transEndTime = new Date().toISOString();
            console.log("Transaction completed in ", new Date(transEndTime).getTime() - new Date(transStartTime).getTime(), "ms");

            return {
                weekId,
                weekProgress,
                phaseId,
                phaseProgress,
                phaseName,
                roadmapProgress,
                roadmapId,
                userExamId,
                weekNumber,
                userExamName,
            };

        }, {
            maxWait: 2000, // Maximum time to wait for the transaction to start
            timeout: 10000, // Maximum time of 10 seconds for the transaction to complete
        });

        const { weekProgress, phaseProgress, roadmapProgress, roadmapId, userExamId, weekNumber, phaseName, userExamName, weekId, phaseId } = transaction;

        console.log(`✅ Task completed for taskId: ${taskId}. Week Progress: ${weekProgress}%, Phase Progress: ${phaseProgress}%, Roadmap Progress: ${roadmapProgress}%`);

        const notifications: string[] = [];

        if (weekProgress === 100) {
            const weekTestNotification = await db.notification.create({
                data: {
                    user_id: userId,
                    roadmap_id: roadmapId,
                    user_exam_id: userExamId,
                    message: `Test for Week ${weekNumber} of ${userExamName} is been unlocked !`,
                    type: NotificationType.TEST,
                },
            });
            notifications.push(weekTestNotification.message);
            console.log(`✅ Week completed for taskId: ${taskId}, weekProgress: ${weekProgress}%`);
        }

        if (phaseProgress === 100) {
            const phaseTestNotification = await db.notification.create({
                data: {
                    user_id: userId,
                    roadmap_id: roadmapId,
                    user_exam_id: userExamId,
                    message: `Test for Phase ${phaseName} of ${userExamName} is been unlocked !`,
                    type: NotificationType.TEST,
                },
            });
            notifications.push(phaseTestNotification.message);
            console.log(`✅ Phase completed for taskId: ${taskId}, phaseProgress: ${phaseProgress}%`);
        }

        if (roadmapProgress === 100) {
            const finalTestNotification = await db.notification.create({
                data: {
                    user_id: userId,
                    roadmap_id: roadmapId,
                    user_exam_id: userExamId,
                    message: `Final tests for ${userExamName} is been unlocked !`,
                    type: NotificationType.TEST,
                },
            });
            notifications.push(finalTestNotification.message);
            console.log(`✅ Roadmap completed for taskId: ${taskId}, roadmapProgress: ${roadmapProgress}%`);
        }

        updateTag(`roadmap-${user_exam_id}-user-${userId}`); // Invalidate the cache for the specific roadmap
        updateTag(`userExams-${userId}`); // Invalidate the cache for the specific user exam
        updateTag(`userDashboard-${userId}`); // Invalidate the cache for the user's dashboard
        updateTag(`tests-${user_exam_id}-user-${userId}`); // Invalidate the cache for the specific exam
        updateTag(`todaysTasks-${userId}`); // Invalidate the cache for today's tasks
        updateTag(`exams`); // Invalidate the cache for all exams
        updateTag(`userExam-${user_exam_id}`); // Invalidate the cache for the specific user exam
        updateTag(`profileData-${userId}`); // Invalidate the cache for the user's profile data
        updateTag(`notifications-${userId}`); // Invalidate the cache for the user's notifications
        revalidatePath(`/profile`); // Revalidate the profile path for the user

        return {
            success: true,
            notifications,
            weekId,
            phaseId,
            weekProgress,
            phaseProgress,
        };

    } catch (error) {
        console.error("❌ Error completing roadmap task:", error);
        return {
            success: false,
            notifications: [],
        };
    }
}

export async function completeMilestone(
    milestoneId: number,
    user_exam_id: number,
    userId: string
): Promise<{ success: boolean }> {
    try {
        if (!milestoneId || Number.isNaN(milestoneId)) {
            return { success: false };
        }

        const milestone = await db.milestone.findUnique({
            where: { id: milestoneId },
            select: {
                achieved: true,
            },
        });

        if (!milestone) {
            return { success: false };
        }

        // Already completed
        if (milestone.achieved) {
            return { success: true };
        }

        await db.milestone.update({
            where: { id: milestoneId },
            data: {
                achieved: true,
            },
        });

        updateTag(`roadmap-${user_exam_id}-user-${userId}`); // Invalidate the cache for the specific milestone
        updateTag(`userExams-${userId}`); // Invalidate the cache for the specific user exam
        updateTag(`userDashboard-${userId}`); // Invalidate the cache for the user's dashboard
        updateTag(`tests-${user_exam_id}-user-${userId}`); // Invalidate the cache for the specific exam
        updateTag(`todaysTasks-${userId}`); // Invalidate the cache for today's tasks
        updateTag(`exams`); // Invalidate the cache for all exams
        updateTag(`userExam-${user_exam_id}`); // Invalidate the cache for the specific user exam
        updateTag(`profileData-${userId}`); // Invalidate the cache for the user's profile data

        return { success: true };
    } catch (error) {
        console.error("Error completing milestone:", error);
        return { success: false };
    }
}

export async function checkEmailExistsLogin(email: string) {
    const user = await db.user.findUnique({
        where: { email },
        include: {
            accounts: true,
        },
    });

    if (!user) {
        return {
            exists: false,
            provider: null,
        };
    }

    console.log("User accounts:", user.accounts);

    const hasGoogle = user.accounts.some(
        (account) => account.providerId === "google"
    );

    const hasGithub = user.accounts.some(
        (account) => account.providerId === "github"
    );

    const hasCredentials = user.accounts.some(
        (account) => account.providerId === "credential"
    );

    return {
        exists: true,
        provider: hasCredentials
            ? "credentials"
            : hasGoogle
                ? "google"
                : hasGithub
                    ? "github"
                    : null,
    };
}

export async function profileSecurityCheck(userId: string) {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: {
            accounts: true,
        },
    });

    if (!user) {
        return null;
    }

    const hasGoogle = user.accounts.some(
        (account) => account.providerId === "google"
    );

    const hasGithub = user.accounts.some(
        (account) => account.providerId === "github"
    );

    const hasCredentials = user.accounts.some(
        (account) => account.providerId === "credential"
    );

    return {
        hasGoogle,
        hasGithub,
        hasCredentials,
    };
}

export async function setPassword(newPassword: string) {
    try {

        const hasCredentialAccount = await auth.api.listUserAccounts({
            headers: await headers(),
        }).then((accounts) => {
            return accounts.some(
                (account) => account.providerId === "credential"
            );
        });

        if (hasCredentialAccount) {
            return {
                success: false,
                message: "Password already set.",
            };
        }

        await auth.api.setPassword({
            headers: await headers(),
            body: {
                newPassword,
            },
        });

        return {
            success: true,
            message: "Password set successfully.",
        };
    } catch (error: any) {
        console.error(error);

        return {
            success: false,
            message:
                error?.body?.message ||
                error?.message ||
                "Failed to set password.",
        };
    }
}

export async function changePassword(
    currentPassword: string,
    newPassword: string
) {
    try {

        await auth.api.listUserAccounts({
            headers: await headers(),
        }).then((accounts) => {
            const hasCredentialAccount = accounts.some(
                (account) => account.providerId === "credential"
            );

            if (!hasCredentialAccount) {
                return {
                    success: false,
                    message: "No credential account found.",
                };
            }
        });

        await auth.api.changePassword({
            headers: await headers(),
            body: {
                currentPassword,
                newPassword,
                revokeOtherSessions: true,
            },
        });

        return {
            success: true,
            message: "Password changed successfully.",
        };
    } catch (error: any) {
        console.error(error);

        return {
            success: false,
            message:
                error?.body?.message ||
                error?.message ||
                "Failed to change password.",
        };
    }
}

export async function contactFormSubmission(formData: {
    name: string;
    email: string;
    subject: string;
    message: string;
}) {
    try {
        const { error } = await resend.emails.send({
            from: "PrepMate Contact <onboarding@resend.dev>",
            to: process.env.NEXT_PUBLIC_GMAIL_USER || "",
            subject: `📩 Contact Form • ${formData.subject}`,

            html: `
                <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;padding:24px;">
                    <h2 style="margin-bottom:20px;">
                        New Contact Form Submission
                    </h2>

                    <table style="width:100%;border-collapse:collapse;">
                        <tr>
                            <td style="padding:10px;font-weight:bold;">Name</td>
                            <td style="padding:10px;">${formData.name}</td>
                        </tr>

                        <tr style="background:#f8fafc;">
                            <td style="padding:10px;font-weight:bold;">Email</td>
                            <td style="padding:10px;">${formData.email}</td>
                        </tr>

                        <tr>
                            <td style="padding:10px;font-weight:bold;">Subject</td>
                            <td style="padding:10px;">${formData.subject}</td>
                        </tr>
                    </table>

                    <div style="margin-top:30px;">
                        <h3>Message</h3>

                        <div
                            style="
                                background:#f8fafc;
                                padding:18px;
                                border-radius:10px;
                                white-space:pre-wrap;
                                line-height:1.6;
                            "
                        >
                            ${formData.message}
                        </div>
                    </div>
                </div>
            `,
        });

        if (error) {
            console.error(error);
            return {
                success: false,
                message: "Unable to send email.",
            };
        }

        return {
            success: true,
            message: "Message sent successfully.",
        };
    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Something went wrong.",
        };
    }

}

export async function getTodaysTasks(userId: string) {

    'use cache';
    cacheTag(`todaysTasks-${userId}`);
    cacheLife('hours'); // Cache for 30 seconds

    try {

        const tasks = await db.roadmapTask.findMany({
            where: {
                week: {
                    phase: {
                        roadmap: {
                            userExam: {
                                user_id: userId,
                                roadmap_status: "completed",
                            },
                        },
                    },
                },
            },
            include: {
                week: {
                    include: {
                        phase: {
                            include: {
                                roadmap: {
                                    include: {
                                        userExam: {
                                            select: {
                                                id: true,
                                                exam_id: true,
                                                start_date: true,
                                                end_date: true,
                                                exam: {
                                                    select: {
                                                        id: true,
                                                        name: true,
                                                    },
                                                }
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                start_date: "asc",
            },
        });

        return {
            success: true,
            tasks,
        }

    } catch (error) {
        console.error("❌ Error fetching today's tasks:", error);
        return {
            success: false,
            message: "Failed to fetch today's tasks.",
        }
    }
}

export async function updateSoundPreference(
    userId: string,
    soundEnabled: boolean
) {
    try {
        await db.user.update({
            where: { id: userId },
            data: { soundEnabled },
        });

        updateTag(`userExams-${userId}`); // Invalidate the cache for the specific user exam
        updateTag(`userDashboard-${userId}`); // Invalidate the cache for the user's dashboard
        updateTag(`todaysTasks-${userId}`); // Invalidate the cache for today's tasks
        return {
            success: true,
        };
    } catch (error) {
        console.error("❌ Error updating sound preference:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to update sound preference.",
        };
    }
}

export async function getCurrentUser(userId: string) {
    try {

        if (!userId) {
            console.error("❌ User ID is required to fetch current user.");
            return null;
        }

        const user = await db.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                soundEnabled: true,
            },
        });

        return user;
    } catch (error) {
        console.error("❌ Error fetching current user:", error);
        return null;
    }
}

export async function getProfileData(userId: string) {

    'use cache';
    cacheTag(`profileData-${userId}`);
    cacheLife('hours');

    if (!userId) {
        console.error("❌ User ID is required to fetch profile data.");
        return null;
    }

    try {

        const user = await db.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                emailVerified: true,
                role: true,
                createdAt: true,

                exams: {
                    select: {
                        id: true,
                        progress_percent: true,
                        start_date: true,
                        end_date: true,

                        exam: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },

                notifications: {
                    orderBy: {
                        created_at: "desc",
                    },
                    take: 5,
                    select: {
                        id: true,
                        message: true,
                        created_at: true,
                        is_read: true,
                        type: true,
                    },
                },
            },
        });

        return user;
    } catch (error) {
        console.error("❌ Error fetching profile data:", error);
        return null;
    }
}

export async function deleteAccount() {
    try {

        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.session) {
            return {
                success: false,
                message: "Unauthorized",
            };
        }

        const userId = session.session.userId;

        // delete user
        await db.user.delete({
            where: {
                id: userId,
            },
        });

        // sign out
        await auth.api.signOut({
            headers: await headers(),
        });

        return {
            success: true,
            message: "Account deleted successfully",
        };

    } catch (error) {

        console.error(
            "Delete account error:",
            error
        );

        return {
            success: false,
            message: "Something went wrong",
        };
    }
}

export async function countUnreadNotifications(userId: string) {

    'use cache';
    cacheTag(`notifications-${userId}`);
    cacheLife('hours');

    if (!userId) {
        console.error("❌ User ID is required to count unread notifications.");
        return 0;
    }

    try {
        const count = await db.notification.count({
            where: {
                user_id: userId,
                is_read: false,
            },
        });

        return count;
    } catch (error) {
        console.error("❌ Error counting unread notifications:", error);
        return 0;
    }
}

export type ProfileUserType = NonNullable<Awaited<ReturnType<typeof getProfileData>>>;







