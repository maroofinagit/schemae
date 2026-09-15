"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    type?: "update" | "delete" | "default";
    onConfirm: () => void;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    type,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {title}
                    </AlertDialogTitle>

                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel
                        className="cursor-pointer"
                    >
                        Cancel
                    </AlertDialogCancel>

                    <AlertDialogAction
                        className={`cursor-pointer ${type === "delete" ? "bg-red-600 text-white hover:bg-red-700" : type === "update" ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                        onClick={onConfirm}>
                        {type === "delete" ? "Delete" : type === "update" ? "Update" : "Confirm"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}