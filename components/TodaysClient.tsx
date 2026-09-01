"use client";

import { useEffect, useMemo, useState } from "react";
import {
    CalendarDays,
    CheckCircle2,
    Clock3,
    Flame,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { AnimatePresence, easeOut, motion, Variants } from "framer-motion";
import { completeRoadmapTask } from "@/app/actions/action";
import { toast } from "sonner";
import { playNotification, playError } from "@/app/lib/sound";
import { useUser } from "@/app/context/userContext";


export default function TodaysClient({ todaysTasks }: { todaysTasks: any[] }) {

    const { soundEnabled, id, name } = useUser();
    const userExamId = todaysTasks[0]?.week.phase.roadmap.userExam.id;
    const [tasks, setTasks] = useState(todaysTasks);

    useEffect(() => {
        setTasks(todaysTasks);
    }, [todaysTasks]);

    const container = {
        hidden: {},
        show: {
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2,
            },
        },
    };

    const today = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate()); //change this to 0 for actual today
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const tomorrow = useMemo(() => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
    }, [today]);

    const stats = useMemo(() => {
        const currentDate = new Date(today);
        currentDate.setHours(0, 0, 0, 0);
        const upcomingEnd = new Date(currentDate);
        upcomingEnd.setDate(upcomingEnd.getDate() + 3);
        upcomingEnd.setHours(23, 59, 59, 999);

        let todayTasks = 0;
        let completedToday = 0;
        let overdue = 0;
        let upcoming = 0;

        tasks.forEach((task) => {
            const start = new Date(task.start_date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(task.end_date);
            end.setHours(23, 59, 59, 999);

            // Today's task
            const isToday = start <= today && end >= today;

            if (isToday) {
                todayTasks++;

                if (task.is_completed) {
                    completedToday++;
                }
            }

            // Overdue
            if (!task.is_completed && end < today) {
                overdue++;
            }

            // Upcoming (next 3 days, excluding today)
            if (
                !task.is_completed &&
                today < start &&
                start <= upcomingEnd
            ) {
                upcoming++;
            }
        });

        console.log("Upcoming tasks:", upcoming);

        return {
            todayTasks,
            completed: completedToday,
            overdue,
            upcoming,
        };
    }, [tasks]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();

        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    }, []);

    const formattedDate = useMemo(() => {
        return new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(today);
    }, [today]);

    const groupedTasks = useMemo(() => {
        const groups = new Map<
            number,
            {
                examId: number;
                examName: string;
                tasks: typeof tasks;
            }
        >();

        tasks.forEach((task) => {
            const start = new Date(task.start_date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(task.end_date);
            end.setHours(23, 59, 59, 999);

            if (!(start <= today && end >= today)) return;

            const exam = task.week.phase.roadmap.userExam.exam;

            if (!groups.has(exam.id)) {
                groups.set(exam.id, {
                    examId: exam.id,
                    examName: exam.name,
                    tasks: [],
                });
            }

            groups.get(exam.id)!.tasks.push(task);
        });

        return Array.from(groups.values());
    }, [tasks]);

    const overdueTasks = useMemo(() => {

        const groups = new Map<
            number,
            {
                examId: number;
                examName: string;
                tasks: typeof tasks;
            }
        >();

        tasks.forEach((task) => {
            if (task.is_completed) return;

            const end = new Date(task.end_date);
            end.setHours(23, 59, 59, 999);

            if (end >= today) return;

            const exam = task.week.phase.roadmap.userExam.exam;

            if (!groups.has(exam.id)) {
                groups.set(exam.id, {
                    examId: exam.id,
                    examName: exam.name,
                    tasks: [],
                });
            }

            groups.get(exam.id)!.tasks.push(task);
        });

        return Array.from(groups.values());
    }, [tasks]);

    const upcomingTasks = useMemo(() => {

        const upcomingEnd = new Date(today);
        upcomingEnd.setDate(upcomingEnd.getDate() + 3);
        upcomingEnd.setHours(23, 59, 59, 999);

        const groups = new Map<
            number,
            {
                examId: number;
                examName: string;
                tasks: typeof tasks;
            }
        >();

        tasks.forEach((task) => {
            if (task.is_completed) return;

            const start = new Date(task.start_date);
            start.setHours(0, 0, 0, 0);

            if (task.is_completed) return;

            // Starts after today and within next 3 days
            if (!(today < start && start <= upcomingEnd)) return;

            const exam = task.week.phase.roadmap.userExam.exam;

            if (!groups.has(exam.id)) {
                groups.set(exam.id, {
                    examId: exam.id,
                    examName: exam.name,
                    tasks: [],
                });
            }

            groups.get(exam.id)!.tasks.push(task);
        });

        return Array.from(groups.values());
    }, [tasks]);

    const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
    const [updatingTasks, setUpdatingTasks] = useState<Record<number, boolean>>({});

    const handleCheckboxChange = (taskId: number) => {
        setCheckedTasks((prev) => ({
            ...prev,
            [taskId]: !prev[taskId],
        }));
    };

    const updateSingleTask = async (taskId: number) => {

        const prevTasks = tasks;

        try {

            setUpdatingTasks((prev) => ({
                ...prev,
                [taskId]: true,
            }));

            setTasks((prev) =>
                prev.map((task) =>
                    task.id === taskId
                        ? {
                            ...task,
                            is_completed: true,
                        }
                        : task
                )
            );

            const res = await completeRoadmapTask(taskId, userExamId, id);

            if (!res.success) throw new Error("Failed to update task");

            if (soundEnabled) {
                playNotification();
            }
            toast.success("Task completed!");

            if (res.notifications && res.notifications.length > 0) {
                res.notifications.forEach((notification, index) => {
                    setTimeout(() => {
                        playNotification();
                        toast(notification, { duration: 3000 });
                    }, (index + 1) * 3000);
                });
            }

        } catch (err) {

            console.log(err);
            if (soundEnabled) {
                playError();
            }
            toast.error("Something went wrong.");
            setTasks(prevTasks);
            setCheckedTasks((prev) => ({
                ...prev,
                [taskId]: false,
            }));
            setUpdatingTasks((prev) => ({
                ...prev,
                [taskId]: false,
            }));

        }
    };

    return (
        <section>

            <div className="md:block hidden min-h-screen space-y-6 pb-12 max-w-7xl mx-auto md:pt-36 pt-20 px-12">
                {/* Hero */}
                <div className="space-y-2">
                    <div className="flex gap-2 flex-col">
                        <span className="text-lg font-medium text-muted-foreground">
                            {greeting},
                        </span>

                        <h1 className="text-4xl font-bold tracking-tight">
                            {name || "there"}
                        </h1>
                    </div>

                    <p className="text-lg text-muted-foreground">
                        Here's your study plan for today.
                    </p>

                    <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        {formattedDate}
                    </div>
                </div>

                {/* Overview Cards */}
                <motion.div
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                    variants={container}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: false, amount: 0.5 }}

                >
                    <OverviewCard
                        title="Today's Tasks"
                        value={stats.todayTasks}
                        icon={<Clock3 className="size-8" />}
                    />

                    <OverviewCard
                        title="Completed"
                        value={stats.completed}
                        total={stats.todayTasks}
                        icon={<CheckCircle2 className="size-8 text-green-500" />}
                    />

                    <OverviewCard
                        title="Overdue"
                        value={stats.overdue}
                        total={stats.todayTasks}
                        icon={<Flame className="size-8 text-red-500" />}
                    />

                    <OverviewCard
                        title="Upcoming"
                        value={stats.upcoming}
                        icon={<CalendarDays className="size-8 text-blue-500" />}
                    />
                </motion.div>

                {/* Today's Tasks */}
                <div className="mt-10 space-y-6">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-2xl font-bold text-blue-700">Today's Focus</h2>

                        <p className="text-muted-foreground">
                            Complete today's planned tasks across all your active exams.
                        </p>
                    </div>

                    {groupedTasks.length === 0 ? (
                        <Card>
                            <CardContent className="flex h-40 items-center justify-center">
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold">
                                        🎉 Nothing planned today
                                    </h3>

                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Enjoy your day or get ahead by starting upcoming tasks.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6 mt-8 grid gap-6 md:grid-cols-2">
                            {groupedTasks.map((group) => (
                                <motion.div
                                    key={group.examId}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: false, amount: 0.2 }}
                                    transition={{ duration: 0.4 }}
                                >

                                    <Card key={group.examId}>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                            <div className="flex flex-col space-y-2">
                                                <CardTitle>{group.examName}</CardTitle>

                                                <CardDescription>
                                                    {group.tasks.length}{" "}
                                                    {group.tasks.length === 1 ? "Task" : "Tasks"} Today
                                                </CardDescription>
                                            </div>

                                        </CardHeader>

                                        <CardContent className="space-y-3">
                                            {group.tasks.map((task) => (
                                                <motion.div
                                                    key={task.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 15 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.96 }}
                                                    whileHover={{ y: -2 }}
                                                    transition={{ duration: 0.25 }}
                                                    className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md md:flex-row md:items-start md:justify-between"
                                                >
                                                    <div className="flex gap-4">
                                                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />

                                                        <div className="space-y-2">
                                                            <h4
                                                                className={`font-semibold transition-colors`}
                                                            >
                                                                {task.title}
                                                            </h4>

                                                            {task.description && (
                                                                <p className="text-sm leading-6 text-muted-foreground line-clamp-2">
                                                                    {task.description}
                                                                </p>
                                                            )}


                                                            <span className="text-xs text-muted-foreground">
                                                                From{" "}
                                                                {new Date(task.start_date).toLocaleDateString("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                })}{" "}
                                                                to{" "}
                                                                {new Date(task.end_date).toLocaleDateString("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                })}
                                                            </span>


                                                            <div className="mt-2 flex flex-col gap-2">
                                                                <span className="text-xs text-muted-foreground">
                                                                    From Week {task.week.week_number}
                                                                </span>
                                                                <Badge className="bg-gray-500 text-white">
                                                                    {task.week.focus}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 flex-wrap justify-end">
                                                        {task.is_completed ? (

                                                            <CheckCircle2 className=" text-green-600" size={20} />
                                                        ) : (
                                                            <>
                                                                <AnimatePresence mode="wait">
                                                                    {checkedTasks[task.id] && (
                                                                        <motion.div
                                                                            key="mark-done"
                                                                            initial={{
                                                                                opacity: 0,
                                                                                width: 0,
                                                                                x: 20,
                                                                            }}
                                                                            animate={{
                                                                                opacity: 1,
                                                                                width: "auto",
                                                                                x: 0,
                                                                            }}
                                                                            exit={{
                                                                                opacity: 0,
                                                                                width: 0,
                                                                                x: 20,
                                                                            }}
                                                                            transition={{
                                                                                duration: 0.25,
                                                                                ease: "easeInOut",
                                                                            }}
                                                                            className="overflow-hidden"
                                                                        >
                                                                            <Button
                                                                                size="sm"
                                                                                className="order-2 cursor-pointer md:order-1 mt-3 md:mt-0 hover:bg-green-700 hover:border-green-700 hover:text-white transition-colors"

                                                                                disabled={updatingTasks[task.id]}
                                                                                onClick={() => updateSingleTask(task.id)}
                                                                            >
                                                                                Mark Done
                                                                            </Button>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                                <Checkbox
                                                                    checked={!!checkedTasks[task.id]}
                                                                    className="cursor-pointer rounded-full border-2 border-green-700 transition-all hover:ring-4 hover:ring-green-500/20"
                                                                    onCheckedChange={() =>
                                                                        handleCheckboxChange(task.id)
                                                                    }
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-10 space-y-2">
                    <h2 className="text-2xl font-bold text-red-600">
                        Due Tasks
                    </h2>

                    <p className="text-muted-foreground">
                        These tasks are overdue and should be completed first.
                    </p>
                </div>

                {
                    overdueTasks.length > 0 ? (
                        <div className="space-y-6 mt-8 grid gap-6 md:grid-cols-2">
                            {overdueTasks.map((group) => (
                                <motion.div
                                    key={group.examId}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: false, amount: 0.1 }}
                                    transition={{ duration: 0.4 }}
                                >

                                    <Card key={group.examId}>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                            <div className="flex flex-col space-y-2">
                                                <CardTitle>{group.examName}</CardTitle>

                                                <CardDescription>
                                                    {group.tasks.length}{" "}
                                                    {group.tasks.length === 1 ? "Task" : "Tasks"} Today
                                                </CardDescription>
                                            </div>

                                        </CardHeader>

                                        <CardContent className="space-y-3">
                                            {group.tasks.map((task) => (
                                                <motion.div
                                                    key={task.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 15 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.96 }}
                                                    whileHover={{ y: -2 }}
                                                    transition={{ duration: 0.25 }}
                                                    className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md md:flex-row md:items-start md:justify-between"
                                                >
                                                    <div className="flex gap-4">
                                                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />

                                                        <div className="space-y-2">
                                                            <h4
                                                                className={`font-semibold transition-colors ${task.is_completed
                                                                    ? "text-muted-foreground line-through"
                                                                    : "group-hover:text-primary"
                                                                    }`}
                                                            >
                                                                {task.title}
                                                            </h4>

                                                            {task.description && (
                                                                <p className="text-sm leading-6 text-muted-foreground line-clamp-2">
                                                                    {task.description}
                                                                </p>
                                                            )}

                                                            <span className="text-xs text-muted-foreground">
                                                                From{" "}
                                                                {new Date(task.start_date).toLocaleDateString("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                })}{" "}
                                                                to{" "}
                                                                {new Date(task.end_date).toLocaleDateString("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                })}
                                                            </span>

                                                            <div className="mt-4 flex flex-col gap-2">
                                                                <span className="text-xs text-muted-foreground">
                                                                    From Week {task.week.week_number}
                                                                </span>
                                                                <Badge className="bg-gray-500 text-white">
                                                                    {task.week.focus}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 flex-wrap justify-end">
                                                        {task.is_completed ? (

                                                            <CheckCircle2 className=" text-green-600" size={20} />
                                                        ) : (
                                                            <>
                                                                <AnimatePresence mode="wait">
                                                                    {checkedTasks[task.id] && (
                                                                        <motion.div
                                                                            key="mark-done"
                                                                            initial={{
                                                                                opacity: 0,
                                                                                width: 0,
                                                                                x: 20,
                                                                            }}
                                                                            animate={{
                                                                                opacity: 1,
                                                                                width: "auto",
                                                                                x: 0,
                                                                            }}
                                                                            exit={{
                                                                                opacity: 0,
                                                                                width: 0,
                                                                                x: 20,
                                                                            }}
                                                                            transition={{
                                                                                duration: 0.25,
                                                                                ease: "easeInOut",
                                                                            }}
                                                                            className="overflow-hidden"
                                                                        >
                                                                            <Button
                                                                                size="sm"
                                                                                className="order-2 cursor-pointer md:order-1 mt-3 md:mt-0 hover:bg-green-700 hover:border-green-700 hover:text-white transition-colors"

                                                                                disabled={updatingTasks[task.id]}
                                                                                onClick={() => updateSingleTask(task.id)}
                                                                            >
                                                                                Mark Done
                                                                            </Button>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                                <Checkbox
                                                                    checked={!!checkedTasks[task.id]}
                                                                    className="cursor-pointer rounded-full border-2 border-green-700 transition-all hover:ring-4 hover:ring-green-500/20"
                                                                    onCheckedChange={() =>
                                                                        handleCheckboxChange(task.id)
                                                                    }
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <Card className="border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/20">
                            <CardContent className="flex h-40 items-center justify-center">
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold text-green-600">
                                        🎉 No overdue tasks
                                    </h3>

                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Great job! You're on track with your study plan.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )
                }

                < div className="mt-10 space-y-2">
                    <h2 className="text-2xl font-bold text-green-700">
                        Upcoming Tasks
                    </h2>

                    <p className="text-muted-foreground">
                        These tasks are scheduled for the next 3 days.
                    </p>
                </div>

                {upcomingTasks.length > 0 ? (
                    <div className="space-y-6 mt-8 grid gap-6 md:grid-cols-2">

                        {upcomingTasks.map((group) => (
                            <motion.div
                                key={group.examId}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, amount: 0.2 }}
                                transition={{ duration: 0.4 }}
                            >

                                <Card key={group.examId}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                        <div className="flex flex-col space-y-2">
                                            <CardTitle>{group.examName}</CardTitle>

                                            <CardDescription>
                                                {group.tasks.length}{" "}
                                                {group.tasks.length === 1 ? "Task" : "Tasks"} Upcoming

                                            </CardDescription>
                                        </div>

                                    </CardHeader>

                                    <CardContent className="space-y-3">
                                        {group.tasks.map((task) => (
                                            <motion.div
                                                key={task.id}
                                                layout
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.96 }}
                                                whileHover={{ y: -2 }}
                                                transition={{ duration: 0.25 }}
                                                className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md md:flex-row md:items-start md:justify-between"
                                            >
                                                <div className="flex gap-4">
                                                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />

                                                    <div className="space-y-2">
                                                        <h4
                                                            className={`font-semibold transition-colors ${task.is_completed
                                                                ? "text-muted-foreground line-through"
                                                                : "group-hover:text-primary"
                                                                }`}
                                                        >
                                                            {task.title}
                                                        </h4>

                                                        {task.description && (
                                                            <p className="text-sm leading-6 text-muted-foreground line-clamp-2">
                                                                {task.description}
                                                            </p>
                                                        )}

                                                        <span className="text-xs text-muted-foreground">
                                                            From{" "}
                                                            {new Date(task.start_date).toLocaleDateString("en-GB", {
                                                                day: "2-digit",
                                                                month: "short",
                                                            })}{" "}
                                                            to{" "}
                                                            {new Date(task.end_date).toLocaleDateString("en-GB", {
                                                                day: "2-digit",
                                                                month: "short",
                                                            })}
                                                        </span>

                                                        <div className="mt-4 flex flex-col gap-2">
                                                            <span className="text-xs text-muted-foreground">
                                                                From Week {task.week.week_number}
                                                            </span>
                                                            <Badge className="bg-gray-600 text-white">
                                                                {task.week.focus}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 flex-wrap justify-end">
                                                    {task.is_completed ? (

                                                        <CheckCircle2 className=" text-green-600" size={20} />
                                                    ) : (
                                                        <>
                                                            <AnimatePresence mode="wait">
                                                                {checkedTasks[task.id] && (
                                                                    <motion.div
                                                                        key="mark-done"
                                                                        initial={{
                                                                            opacity: 0,
                                                                            width: 0,
                                                                            x: 20,
                                                                        }}
                                                                        animate={{
                                                                            opacity: 1,
                                                                            width: "auto",
                                                                            x: 0,
                                                                        }}
                                                                        exit={{
                                                                            opacity: 0,
                                                                            width: 0,
                                                                            x: 20,
                                                                        }}
                                                                        transition={{
                                                                            duration: 0.25,
                                                                            ease: "easeInOut",
                                                                        }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <Button
                                                                            size="sm"
                                                                            className="order-2 cursor-pointer md:order-1 mt-3 md:mt-0 hover:bg-green-700 hover:border-green-700 hover:text-white transition-colors"

                                                                            disabled={updatingTasks[task.id]}
                                                                            onClick={() => updateSingleTask(task.id)}
                                                                        >
                                                                            Mark Done
                                                                        </Button>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                            <Checkbox
                                                                checked={!!checkedTasks[task.id]}
                                                                className="cursor-pointer rounded-full border-2 border-green-700 transition-all hover:ring-4 hover:ring-green-500/20"
                                                                onCheckedChange={() =>
                                                                    handleCheckboxChange(task.id)
                                                                }
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <Card className="border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/20">
                        <CardContent className="flex h-40 items-center justify-center">
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-green-700">
                                    🕒 No upcoming tasks
                                </h3>

                                <p className="mt-2 text-sm text-muted-foreground">
                                    You don't have any tasks scheduled for the next 3 days.
                                </p>
                            </div>
                        </CardContent>

                    </Card>
                )}
            </div>

            <div className="md:hidden h-screen px-10 flex justify-center items-center mt-10 space-y-2">
                <span className="text-xl font-bold text-green-700">
                    Sorry, this section is only available on larger screens. Please use a desktop or tablet device to view the full dashboard.
                </span>
            </div>

        </section>
    );
}

function OverviewCard({
    title,
    value,
    total,
    icon,
}: {
    title: string;
    value: number;
    total?: number;
    icon: React.ReactNode;
}) {

    const itemVariants: Variants = {
        hidden: {
            opacity: 0,
            y: 25,
        },
        show: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.3,
                ease: easeOut,
            },
        },
    };

    return (
        <motion.div
            variants={itemVariants}
            className=""
        >
            <Card className="group relative h-full overflow-hidden rounded-2xl border border-slate-30 hover:border-green-600 bg-white shadow-sm ease-in-out duration-300 hover:shadow-xl ">

                <CardContent className="relative flex items-center justify-between p-6">
                    <div>
                        <p className="text-sm font-medium text-slate-500">
                            {title}
                        </p>

                        <motion.h2
                            key={value}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.25 }}
                            className="mt-2 text-4xl font-bold tracking-tight text-slate-900"
                        >
                            {value}
                        </motion.h2>

                        {total !== undefined && (
                            <p className="mt-1 text-sm text-slate-500">
                                of{" "}
                                <span className="font-semibold text-slate-700">
                                    {total}
                                </span>{" "}
                                tasks
                            </p>
                        )}
                    </div>

                    <div className="absolute right-4 top-4 text-slate-300 transition-colors group-hover:text-green-600 p-4 rounded-full shadow-xl group-hover:bg-green-100/50">

                        {icon}
                    </div>

                </CardContent>
            </Card>
        </motion.div>

    );
}