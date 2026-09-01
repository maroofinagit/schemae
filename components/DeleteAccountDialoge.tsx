"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAccount } from "@/app/actions/action";

export function DeleteAccountDialog() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        try {
            setLoading(true);

            const res = await deleteAccount();

            if (!res.success) {
                toast.error(res.message || "Failed to delete account. Please try again.");
                return;
            }

            toast.success(res.message || "Account deleted successfully.");
            router.push("/");
        } catch (err) {
            console.error(err);
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="bg-transparent text-red-600 px-5 py-2 rounded-lg hover:bg-red-600 border border-red-600 hover:text-white font-medium transition cursor-pointer">
                    Delete Account
                </button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-red-600">
                        Delete your account?
                    </DialogTitle>
                    <DialogDescription>
                        This action is permanent. All your data will be removed and cannot be recovered.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600">
                    ⚠️ This includes your exams, progress, and notifications.
                </div>

                <DialogFooter className="mt-4">
                    <DialogClose asChild>
                        <button
                            className="px-4 py-2 rounded-md border cursor-pointer hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </DialogClose>

                    <button
                        onClick={handleDelete}
                        disabled={loading}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        {loading ? "Deleting..." : "Yes, Delete"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}