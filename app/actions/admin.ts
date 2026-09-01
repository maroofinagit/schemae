"use server";

import { Resend } from "resend";
import { db } from "../lib/db";
import { auth } from "../lib/auth";
import { headers } from "next/headers";
import { getEmailTemplate } from "@/app/lib/emailTempelete";
import nodemailer from "nodemailer";
import { updateTag } from "next/cache";

const mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});

export async function getAdminDashboardData() {
    const totalUsers = await db.user.count();

    const users = await db.user.findMany({
        include: {
            exams: {
                include: {
                    exam: true,
                },
            },
        },
    });

    return {
        totalUsers,
        users,
    };
}

export async function getUserDetails(userId: string) {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: {
            exams: {
                include: {
                    exam: true,
                    roadmap: true,
                },
            },
        },
    });

    if (!user) {
        throw new Error("User not found");
    }

    return user;
}

// Admin action to send email to a Admin when a new user signs up without enrolling in any exam
export async function sendSignUpAdminNot(to: string, name: string) {

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        await resend.emails.send({
            from: "Schemae <onboarding@resend.dev>",
            to: process.env.NEXT_PUBLIC_GMAIL_USER!, // Admin email address from environment variable
            subject: "New User Signup Notification - Schemae 🚀",
            html: `
<div style="font-family:Arial,sans-serif;background-color:#f4f6f8;padding:30px;">

  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:25px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    
    <h2 style="margin-bottom:10px;color:#111;">
      🚀 New User Signup
    </h2>

    <p style="color:#555;margin-bottom:20px;">
      A new user has just registered on <b>Schemae</b>.
    </p>

    <div style="background:#f9fafb;padding:15px;border-radius:8px;border:1px solid #eee;">
      
      <p style="margin:8px 0;">
        <strong>Name:</strong> ${name}
      </p>

      <p style="margin:8px 0;">
        <strong>Email:</strong> ${to}
      </p>

    </div>

    <hr style="border:none;border-top:1px solid #eee;margin:25px 0;" />

    <p style="font-size:13px;color:#888;">
      This is an automated notification from Schemae.
    </p>

  </div>

</div>
`
        });
        return { success: true };
    } catch (error) {
        console.error("Error sending admin notification email:", error);
        return { success: false };

    }
}

interface SendEmailProps {
    to: string;
    name: string;
    subject: string;
    body: string;
}

export async function sendEmail({
    to,
    name,
    subject,
    body,
}: SendEmailProps) {
    try {

        // Wrap inside your email template
        const html = await getEmailTemplate({
            name,
            body,
        });

        await mailTransporter.sendMail({
            from: `"Schemae" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html,
        });

        return { success: true };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false };
    }
}


export async function sendBulkEmail({
    subject,
    body,
}: {
    subject: string;
    body: string;
}) {
    try {
        const users = await db.user.findMany({
            where: {
                role: 'student',
            },
        });

        const validUsers = users.filter(
            (user): user is typeof user & { email: string; name: string } =>
                user.email !== null && user.name !== null
        );

        for (const user of validUsers) {
            await sendEmail({
                to: user.email,
                name: user.name,
                subject,
                body,
            });
        }
        return { success: true, message: "Bulk email sent successfully" };
    } catch (error) {
        console.error("Error sending bulk email:", error);
        return { success: false, message: "Failed to send bulk email" };
    }
}

export async function getUserData(userId: string) {
    try {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: {
                email: true,
                name: true,
            },
        });

        if (!user) {
            return { success: false, message: "User not found" };
        }

        return { success: true, data: user };
    } catch (error) {
        console.error("Error fetching user data:", error);
        return { success: false, message: "Failed to fetch user data" };
    }
}

export async function sendAdminNotification(message: string) {
    if (!message.trim()) {
        return {
            success: false,
            error: "Notification message cannot be empty.",
        };
    }

    try {
        const users = await db.user.findMany({
            select: {
                id: true,
            },
        });

        if (users.length === 0) {
            return {
                success: false,
                error: "No users found.",
            };
        }

        await db.notification.createMany({
            data: users.map((user) => ({
                user_id: user.id,
                message: message.trim(),
                type: "ADMIN",
            })),
        });

        users.forEach(async (user) => {
            updateTag(`notifications-${user.id}`);
        });

        return {
            success: true,
            message: `Notification sent to ${users.length} users.`,
        };
    } catch (error) {
        console.error("Failed to send admin notification:", error);

        return {
            success: false,
            error: "Failed to send notification.",
        };
    }
}

export async function sendNotificationToUser(
    userId: string,
    message: string
) {
    if (!message.trim()) {
        return {
            success: false,
            error: "Notification message cannot be empty.",
        };
    }

    try {
        await db.notification.create({
            data: {
                user_id: userId,
                message: message.trim(),
                type: "ADMIN",
            },
        });

        updateTag(`notifications-${userId}`);

        return {
            success: true,
        };
    } catch (error) {
        console.error("Failed to send notification:", error);

        return {
            success: false,
            error: "Failed to send notification.",
        };
    }
}
