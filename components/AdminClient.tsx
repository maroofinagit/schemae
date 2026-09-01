"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { sendAdminNotification } from "@/app/actions/admin";
import { useState } from "react";
import { toast } from "sonner";


export default function AdminClient({ data }: any) {
    const [notificationDialogOpen, setNotificationDialogOpen] =
        useState(false);

    const [message, setMessage] = useState("");
    const [isPending, setIsPending] = useState(false);

    const handleSendNotification = async () => {
        setIsPending(true);

        if (!message.trim()) return;

        const result = await sendAdminNotification(message);

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

    return (
        <div className="p-6 bg-gray-50 min-h-screen pt-32 md:px-12 px-6">

            {/* 🔥 HEADER */}
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

            {/* 📊 STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                <div className="bg-white shadow-sm rounded-xl p-5 border">
                    <p className="text-gray-500 text-sm">Total Users</p>
                    <h2 className="text-2xl font-bold mt-2">
                        {data.totalUsers}
                    </h2>
                </div>

                <div className="bg-white shadow-sm rounded-xl p-5 border">
                    <p className="text-gray-500 text-sm">Total Exams</p>
                    <h2 className="text-2xl font-bold mt-2">
                        {data.users.reduce((acc: number, u: any) => acc + u.exams.length, 0)}
                    </h2>
                </div>

                <div className="bg-white shadow-sm rounded-xl p-5 border">
                    <p className="text-gray-500 text-sm">Completed Roadmaps</p>
                    <h2 className="text-2xl font-bold mt-2">
                        {
                            data.users.flatMap((u: any) => u.exams)
                                .filter((e: any) => e.roadmap_status === "completed").length
                        }
                    </h2>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <Link
                    href="/admin/sendBulkEmail"
                    className="inline-block px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 cursor-pointer text-sm"
                >
                    ✉️ Send Bulk Email
                </Link>

                <Button
                    onClick={() => setNotificationDialogOpen(true)}
                    className="bg-black text-white hover:bg-gray-800 cursor-pointer"
                >
                    🔔 Send Notification
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
                            This notification will be sent to all users.
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


            {/* 📋 USERS TABLE */}
            <div className="bg-white shadow-sm rounded-xl border overflow-hidden">

                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">Users & Exams</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">

                        <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="p-3">User</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Exam</th>
                                <th className="p-3">Progress</th>
                                <th className="p-3">Roadmap</th>
                            </tr>
                        </thead>

                        <tbody>
                            {data.users.map((user: any) =>
                                user.exams.length > 0 ? (
                                    user.exams.map((exam: any, idx: number) => (
                                        <tr
                                            key={exam.id}
                                            className="border-t hover:bg-gray-50 transition"
                                        >
                                            {idx === 0 && (
                                                <>
                                                    <td
                                                        rowSpan={user.exams.length}
                                                        className="p-3 font-medium align-top"
                                                    >
                                                        {user.name || "No Name"}
                                                    </td>
                                                    <td
                                                        rowSpan={user.exams.length}
                                                        className="p-3 underline text-gray-600 align-top"
                                                    >
                                                        <Link href={`/admin/users/${user.id}`}>
                                                            {user.email}
                                                        </Link>
                                                    </td>
                                                </>
                                            )}

                                            <td className="p-3">{exam.exam.name}</td>

                                            {/* 🎯 PROGRESS */}
                                            <td className="p-3 w-40">
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-black h-2 rounded-full"
                                                        style={{
                                                            width: `${exam.progress_percent || 0}%`,
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-xs mt-1 text-gray-500">
                                                    {exam.progress_percent || 0}%
                                                </p>
                                            </td>

                                            {/* 🟢 STATUS */}
                                            <td className="p-3">
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-medium ${exam.roadmap_status === "completed"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-yellow-100 text-yellow-700"
                                                        }`}
                                                >
                                                    {exam.roadmap_status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr key={user.id} className="border-t">
                                        <td className="p-3 font-medium">
                                            {user.name || "No Name"}
                                        </td>
                                        <td className="p-3 text-gray-600">
                                            <Link href={`/admin/users/${user.id}`} className="underline">
                                                {user.email}
                                            </Link>
                                        </td>
                                        <td colSpan={3} className="p-3 text-gray-400">
                                            No exams enrolled
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>

                    </table>
                </div>
            </div>
        </div>
    );
}