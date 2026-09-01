"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

import { sendNotificationToUser } from "@/app/actions/admin";

export default function UserDetailClient({ user }: any) {

    const [notificationDialogOpen, setNotificationDialogOpen] =
        useState(false);

    const [message, setMessage] = useState("");
    const [isPending, setIsPending] = useState(false);

    const handleSendNotification = async () => {
        setIsPending(true);

        if (!message.trim()) return;

        const result = await sendNotificationToUser(user.id, message);

        if (result.success) {
            setMessage("");
            setNotificationDialogOpen(false);
            toast.success("Notification sent successfully!");
        } else {
            console.error(result.error);
            toast.error("Failed to send notification.");
        }
        setIsPending(false);
    };

    const router = useRouter();

    const totalExams = user.exams.length;

    const roadmapGenerated = user.exams.filter(
        (e: any) => e.roadmap !== null
    ).length;

    const roadmapCompleted = user.exams.filter(
        (e: any) => e.roadmap_status === "completed"
    ).length;

    const avgProgress = Math.round(
        user.exams.reduce(
            (acc: number, e: any) => acc + (e.progress_percent || 0),
            0
        ) / (totalExams || 1)
    );


    return (
        <div className="p-6 bg-gray-50 min-h-screen pt-32 md:px-12 px-6">

            {/* 👤 PROFILE HEADER */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6 flex items-center gap-6">

                {/* 🖼️ IMAGE */}
                <img
                    src={user.image || "/avatar.png"}
                    alt="user"
                    className="w-20 h-20 rounded-full object-cover border"
                />

                {/* 🧾 INFO */}
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">
                        {user.name || "No Name"}
                    </h1>

                    <p className="text-gray-500">{user.email}</p>

                    <div className="flex gap-3 mt-3 flex-wrap">

                        {/* ROLE */}
                        <span
                            className={`px-3 py-1 text-xs rounded-full font-medium ${user.role === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                                }`}
                        >
                            {user.role}
                        </span>

                        {/* VERIFIED */}
                        <span
                            className={`px-3 py-1 text-xs rounded-full ${user.emailVerified
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-600"
                                }`}
                        >
                            {user.emailVerified ? "Verified" : "Not Verified"}
                        </span>

                        {/* CREATED DATE */}
                        <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                            Joined {user.createdAt.toLocaleDateString()}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <Link
                        href={`/admin/sendEmail/${user.id}`}
                        className="inline-block px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 cursor-pointer text-sm"
                    >
                        Send Email
                    </Link>

                    <Button
                        onClick={() => setNotificationDialogOpen(true)}
                        className="bg-black text-white hover:bg-gray-800 cursor-pointer"
                    >
                        Send Notification
                    </Button>
                </div>

                <Dialog
                    open={notificationDialogOpen}
                    onOpenChange={setNotificationDialogOpen}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Send Notification
                            </DialogTitle>

                            <DialogDescription>
                                This notification will be sent to the {user.name}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="notification"
                                    className="text-sm font-medium text-foreground"
                                >
                                    Notification
                                </label>

                                <span className="text-xs text-muted-foreground">
                                    {message.length}/100
                                </span>
                            </div>

                            <div className="relative">
                                <textarea
                                    id="notification"
                                    rows={2}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Write a short notification for your users..."
                                    maxLength={100}
                                    className="
                w-full
                resize-none
                rounded-xl
                border border-border
                bg-muted/30
                px-4 py-3
                text-sm
                text-foreground
                placeholder:text-muted-foreground
                outline-none
                transition-all duration-200
                focus:border-foreground/30
                focus:bg-background
                focus:ring-2
                focus:ring-foreground/10
            "
                                />
                            </div>

                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setNotificationDialogOpen(false)
                                }
                                disabled={isPending}
                            >
                                Cancel
                            </Button>

                            <Button
                                onClick={handleSendNotification}
                                disabled={
                                    isPending || !message.trim()
                                }
                                className="bg-black text-white hover:bg-green-700 cursor-pointer"
                            >
                                {isPending
                                    ? "Sending..."
                                    : "Send Notification"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>

            {/* 📊 STATS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">

                <StatCard title="Total Exams" value={totalExams} />
                <StatCard title="Roadmaps Generated" value={roadmapGenerated} />
                <StatCard title="Roadmaps Completed" value={roadmapCompleted} />
                <StatCard title="Avg Progress" value={`${avgProgress}%`} />

            </div>

            {/* 📘 EXAMS */}
            <div className="bg-white rounded-xl shadow-sm border">

                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Exam Journey</h2>
                    <span className="text-sm text-gray-500">
                        {totalExams} enrolled
                    </span>
                </div>

                <div className="divide-y">
                    {user.exams.map((exam: any) => (
                        <div key={exam.id} className="p-5">

                            {/* 🧠 TOP ROW */}
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-base">
                                    {exam.exam.name}
                                </h3>

                                <span
                                    className={`px-2 py-1 text-xs rounded-full ${!exam.roadmap
                                        ? "bg-gray-100 text-gray-600"
                                        : exam.roadmap_status === "completed"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-yellow-100 text-yellow-700"
                                        }`}
                                >
                                    {!exam.roadmap
                                        ? "No Roadmap"
                                        : exam.roadmap_status === "completed"
                                            ? "Completed"
                                            : "In Progress"}
                                </span>
                            </div>

                            {/* 📅 DATES */}
                            <p className="text-sm text-gray-500 mt-1">
                                {new Date(exam.start_date).toLocaleDateString()} →{" "}
                                {new Date(exam.end_date).toLocaleDateString()}
                            </p>

                            {/* 🎯 PROGRESS BAR */}
                            <div className="mt-3">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-black h-2 rounded-full"
                                        style={{
                                            width: `${exam.progress_percent || 0}%`,
                                        }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>{exam.progress_percent || 0}% completed</span>
                                    <span>
                                        Stage: {exam.current_stage || "N/A"}
                                    </span>
                                </div>
                            </div>

                            {/* 🧩 EXTRA DETAILS */}
                            <div className="mt-3 flex gap-4 flex-wrap text-xs text-gray-600">
                                <span>
                                    📍 Roadmap: {exam.roadmap ? "Generated" : "Not Generated"}
                                </span>

                                <span>
                                    📆 Created:{" "}
                                    {new Date(exam.created_at).toLocaleDateString()}
                                </span>
                            </div>

                        </div>
                    ))}
                </div>
            </div>

            {/* 🔙 BACK BUTTON */}
            <div className="mt-6">
                <Button variant="outline" className="hover:bg-black hover:text-white cursor-pointer" onClick={() => router.push("/admin")}>
                    Back to Dashboard
                </Button>
            </div>

        </div>
    );
}

/* 🧩 REUSABLE STAT CARD */
function StatCard({ title, value }: any) {
    return (
        <div className="bg-white p-5 rounded-xl border shadow-sm">
            <p className="text-gray-500 text-sm">{title}</p>
            <h2 className="text-xl font-bold mt-2">{value}</h2>
        </div>
    );
}