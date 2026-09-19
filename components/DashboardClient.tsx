"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
    Card,
    CardHeader,
    CardContent,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import Image from "next/image";
import {
    XAxis,
    YAxis,
    BarChart,
    Bar,
    PieChart,
    Pie,
    AreaChart,
    CartesianGrid,
    Area,
    LineChart,
    Line,
} from "recharts";
import { RoadmapStatus } from "@/generated/prisma/enums";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "./ui/chart";
import {
    Award,
    BadgeCheck,
    BookOpen,
    CircleX,
    ClipboardCheck,
    Clock3,
    FileText,
    Lightbulb,
    Route,
    Sparkles,
    Trash2,
    TrendingDown,
    TrendingUp,
    TriangleAlert,
} from "lucide-react";
import { generateRoadmap } from "@/app/actions/roadmap";
import { Separator } from "./ui/separator";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { DashboardUser, deleteUserExam } from "@/app/actions/action";
import { Badge } from "./ui/badge";
import { useUser } from "@/app/context/userContext";
import { playError, playNotification } from "@/app/lib/sound";
import VisitMobile from "./VisitMobile";

type WeakTopic = {
    id: number;
    name: string;

    correctCount: number;
    wrongCount: number;
    totalQuestions: number;
    accuracy: number;

    tasks: {
        id: number;
        title: string;
    }[];
};

export default function DashboardAnalytics({
    dashboardUser,
}: {
    dashboardUser: DashboardUser;
}) {
    const { soundEnabled, name } = useUser();
    const exams = dashboardUser?.exams || [];
    const [newExams, setNewExams] = useState(exams);
    const [selectedExam, setSelectedExam] = useState(
        newExams.length ? newExams[0] : null,
    );
    const [regenerating, setRegenerating] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [progress, setProgress] = useState(0);
    const [deleting, setDeleting] = useState(false);
    const [dltDialogOpen, setDltDialogOpen] = useState(false);
    const messageLoopRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!regenerating) {
            setElapsedSeconds(0);
            return;
        }

        const interval = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [regenerating]);

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${remainingSeconds
            .toString()
            .padStart(2, "0")}`;
    };

    useEffect(() => {
        setNewExams(dashboardUser?.exams ?? []);
    }, [dashboardUser?.exams]);

    useEffect(() => {
        if (!newExams.length) {
            setSelectedExam(null);
            return;
        }

        setSelectedExam((prev) => {
            if (!prev) return newExams[0];

            return newExams.find((exam) => exam.id === prev.id) ?? newExams[0];
        });
    }, [newExams]);

    const currentSelectedExam = useMemo(() => {
        if (!selectedExam) return null;
        // try to find the same id in latest exams array
        return newExams.find((e) => e.id === selectedExam.id) || null;
    }, [newExams, selectedExam]);

    const exam = currentSelectedExam; // alias
    const roadmap = exam?.roadmap || null;
    const phases = roadmap?.phases || [];
    const milestones = roadmap?.milestones || [];

    // for phase progress bar chart
    const phaseProgressData = phases.map((p: any) => ({
        name: p.phase_name ?? "Phase",
        progress: Math.round(p.progress ?? 0),
    }));

    // for weekly progress area chart - flatten all weeks from all phases into one array
    const weekProgressData = phases
        .flatMap((p: any) =>
            (p.weeks || []).map((w: any) => ({
                week: `W${w.week_number ?? "?"}`, // 👈 display
                progress: Math.round(w.progress ?? 0),
                weekNumber:
                    typeof w.week_number === "number" ? w.week_number : Infinity, // 👈 logic
            })),
        )
        .sort((a, b) => a.weekNumber - b.weekNumber);

    // safe values for top cards
    const totalUserExams = newExams.length;

    // safe values for top cards
    const selectedProgress = exam?.progress_percent ?? 0;
    const selectedId = exam?.id ?? null;
    const roadmapStatus = exam?.roadmap_status;

    // safe values for top performance cards
    const performanceScore = exam?.performanceScore ?? 0;
    const highestScore = exam?.highestScore ?? 0;
    const lowestScore = exam?.lowestScore ?? 0;
    const lastTestScore = exam?.lastTestScore ?? 0;

    const totalTests = exam?.tests?.length ?? 0;

    const testsGenerated = exam?.tests?.filter((t) => t.isGenerated).length ?? 0;

    const testsAttempted = exam?.tests?.filter((t) => t.attempt).length ?? 0;

    const testsPassed =
        exam?.tests?.filter((t) => t.attempt?.isPassed).length ?? 0;

    const testsFailed =
        exam?.tests?.filter((t) => t.attempt && !t.attempt.isPassed).length ?? 0;

    //performance trend
    const performanceTrend =
        exam?.tests
            ?.filter((test: (typeof exam.tests)[number]) => test.attempt)
            .sort(
                (a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            )
            .map((test, index) => ({
                test: `Test ${index + 1}`,
                score: test.attempt!.percentage,
                type: test.type,
            })) ?? [];

    const performanceChartConfig = {
        score: {
            label: "Score",
            color: "hsl(var(--chart-1))",
        },
    } satisfies ChartConfig;

    // performance pie chart data
    const pfPieChartData = [
        {
            status: "Passed",
            value: testsAttempted
                ? Math.round((testsPassed / testsAttempted) * 100)
                : 0,
            fill: "var(--color-passed)",
        },
        {
            status: "Failed",
            value: testsAttempted
                ? Math.round((testsFailed / testsAttempted) * 100)
                : 0,
            fill: "var(--color-failed)",
        },
    ];

    const pfChartConfig = {
        value: {
            label: "Percentage",
        },
        passed: {
            label: "Passed",
            color: "#22c55e", // green
        },
        failed: {
            label: "Failed",
            color: "#ef4444", // red
        },
    } satisfies ChartConfig;

    // Chart config (labels, colors, etc.)
    const chartConfig = {
        value: {
            label: "Progress",
        },
        completed: {
            label: "Completed",
            color: "#22c55e", // green
        },
        remaining: {
            label: "Remaining",
            color: "#e5e7eb", // gray
        },
    } satisfies ChartConfig;

    //PieChart Value
    const pieChartData = [
        {
            status: "Completed",
            value: selectedProgress ?? 0,
            fill: "var(--color-completed)",
        },
        {
            status: "Remaining",
            value: Math.max(0, 100 - (selectedProgress ?? 0)),
            fill: "var(--color-remaining)",
        },
    ];

    const passRate =
        testsAttempted > 0 ? Math.round((testsPassed / testsAttempted) * 100) : 0;

    const overallPerformanceSummary =
        performanceScore >= 85
            ? "Excellent performance with consistently strong test results."
            : performanceScore >= 70
                ? "Good overall performance with room for further improvement."
                : performanceScore >= 50
                    ? "Average performance. More practice is needed to strengthen concepts."
                    : "Performance is currently below expectations and requires focused practice.";

    const roadmapSummary =
        selectedProgress >= 90
            ? `Your roadmap is ${selectedProgress}% complete and is almost finished.`
            : selectedProgress >= 70
                ? `Your roadmap is ${selectedProgress}% complete with good overall progress.`
                : selectedProgress >= 40
                    ? `Your roadmap is ${selectedProgress}% complete and progressing steadily.`
                    : `Your roadmap is ${selectedProgress}% complete. Continue completing weekly tasks.`;

    const testsSummary =
        totalTests === 0
            ? "No tests have been generated yet."
            : testsAttempted === totalTests
                ? `All ${totalTests} available tests have been completed.`
                : testsAttempted >= totalTests * 0.75
                    ? `${testsAttempted} of ${totalTests} tests have been completed.`
                    : testsAttempted >= totalTests * 0.4
                        ? `${testsAttempted} of ${totalTests} tests have been attempted so far.`
                        : `Only ${testsAttempted} of ${totalTests} tests have been attempted.`;

    const passRateSummary =
        testsAttempted === 0
            ? "No tests have been attempted yet."
            : passRate >= 85
                ? `Passed ${testsPassed} tests and failed ${testsFailed}, achieving an excellent ${passRate}% pass rate.`
                : passRate >= 70
                    ? `Passed ${testsPassed} tests and failed ${testsFailed}, achieving a healthy ${passRate}% pass rate.`
                    : passRate >= 50
                        ? `Passed ${testsPassed} tests and failed ${testsFailed}, resulting in a ${passRate}% pass rate.`
                        : `Passed ${testsPassed} tests and failed ${testsFailed}. Your current pass rate is ${passRate}%.`;

    const latestPerformanceSummary =
        testsAttempted === 0
            ? "No test attempts are available yet."
            : lastTestScore >= highestScore - 5
                ? `Your latest test score is ${lastTestScore}%, which is close to your personal best of ${highestScore}%.`
                : lastTestScore > performanceScore
                    ? `Your latest test score is ${lastTestScore}%, which is above your average performance.`
                    : lastTestScore < performanceScore
                        ? `Your latest test score is ${lastTestScore}%, which is below your average performance.`
                        : `Your latest test score is ${lastTestScore}%, matching your overall average.`;

    const suggestions: string[] = [];

    if (selectedProgress < 50)
        suggestions.push(
            "Complete more roadmap tasks to build a stronger foundation.",
        );

    if (testsAttempted < totalTests / 2)
        suggestions.push(
            "Attempt more practice tests to improve your preparation.",
        );

    if (passRate < 60 && testsAttempted > 0)
        suggestions.push(
            "Review incorrect answers before taking the next assessment.",
        );

    if (performanceScore >= 85)
        suggestions.push(
            "Maintain your momentum by attempting more advanced tests.",
        );

    if (performanceScore >= 70 && passRate >= 70 && selectedProgress >= 70) {
        suggestions.push(
            "You're progressing well. Keep practicing consistently to reach mastery.",
        );
    }

    if (suggestions.length === 0) {
        suggestions.push("Keep following your roadmap and practice regularly.");
    }

    useEffect(() => {
        // check if roadmap is not generated if not show a toast to inform user to generate roadmap
        if (selectedExam && selectedExam.roadmap_status === RoadmapStatus.failed) {
            toast.error(
                `Your roadmap for ${selectedExam.exam?.name ?? "the selected exam"} is not generated yet. Please click "Regenerate Roadmap" to create your personalized study plan.`,
                {
                    duration: 4000, // show for 4 seconds
                },
            );
        }
    }, [exams, selectedExam]);

    const router = useRouter();

    function startMessageLoop(
        messages: string[],
        interval = 5000
    ) {
        let index = 0;

        setLoadingMessage(messages[index]);

        const id = setInterval(() => {
            index = (index + 1) % messages.length;
            setLoadingMessage(messages[index]);
        }, interval);

        return id;
    }

    const handleRegenerate = async () => {
        if (!selectedId) return;
        setRegenerating(true);
        setLoadingMessage("Initializing roadmap regeneration...");
        toast.info(
            "Roadmap regeneration started. It may take a few moments to complete.",
        );
        await new Promise((r) => setTimeout(r, 1000));

        const eventSource = new EventSource(
            `/api/roadmap/stream?userExamId=${selectedId}`,
        );

        // 3️⃣ Receive events from server
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            console.log("SSE event:", data);

            // Server has established the connection
            if (data.type === "connected") {
                setLoadingMessage(
                    "Starting your personalized roadmap..."
                );
                setProgress(8);
            }

            // progress
            if (data.type === "progress") {

                setProgress(data.progress);

                // AI generation starts
                if (data.step === "ai_generation" || data.step === "loading_existing") {

                    if (!messageLoopRef.current) {
                        const aiMessages = [
                            "Analyzing your syllabus and exam requirements... ⏳",
                            "Building the structure of your personalized roadmap...",
                            "Connecting topics in the right learning order...",
                            "Balancing difficult topics across your preparation period...",
                            "Planning your weekly milestones and study strategy...",
                            "Making sure your roadmap fits your preparation timeline...",
                            "Almost there... the AI is putting the final pieces together ✨",
                        ];

                        messageLoopRef.current =
                            startMessageLoop(
                                aiMessages,
                                5000
                            );
                    }

                    return;
                }

                // Any progress event after AI generation
                // means the AI stage is over.
                if (messageLoopRef.current) {
                    clearInterval(messageLoopRef.current);
                    messageLoopRef.current = null;
                }

                // Show the REAL server message
                setLoadingMessage(data.message);
            }

            // Generation completed
            if (data.type === "completed") {
                eventSource.close();
                setProgress(100);

                if (soundEnabled) {
                    playNotification();
                }

                toast.success(
                    "🎉 Roadmap generated successfully!"
                );

                setLoadingMessage(
                    "🎯 Roadmap ready! Redirecting to your dashboard..."
                );
                setRegenerating(false);

                setTimeout(() => {
                    router.replace(
                        `/dashboard/roadmap/${selectedId}`
                    );
                }, 1000);
            }

            // Generation failed
            if (data.type === "error") {
                eventSource.close();

                setRegenerating(false);

                if (soundEnabled) {
                    playError();
                }

                toast.error(
                    "Failed to generate roadmap. You can create one later from your dashboard.",
                    {
                        duration: 2000,
                    }
                );

                setLoadingMessage(
                    "Failed to generate roadmap. Redirecting to dashboard..."
                );
                setProgress(0);

                setTimeout(() => {
                    router.replace("/dashboard");
                }, 2000);
            }
        };

        // 4️⃣ Connection-level error
        eventSource.onerror = () => {
            console.error(
                "SSE connection error"
            );

            eventSource.close();

            if (soundEnabled) {
                playError();
            }

            toast.error(
                "Connection to roadmap generator was lost.",
                {
                    duration: 3000,
                }
            );

            setRegenerating(false);
            setLoadingMessage(
                "Connection lost. Redirecting to dashboard..."
            );

            setProgress(0);

            setTimeout(() => {
                router.replace("/dashboard");
            }, 3000);

        };

    };

    const handleDelete = async () => {
        if (!selectedId) return;
        try {
            setDeleting(true);
            const res = await deleteUserExam(
                selectedId,
                dashboardUser?.id?.toString() ?? "",
            );
            if (res.success) {
                if (soundEnabled) {
                    playNotification();
                }
                toast.success("Exam deleted successfully.", {
                    duration: 2000,
                });
            } else {
                if (soundEnabled) {
                    playError();
                }
                toast.error("Failed to delete exam.", {
                    duration: 2000,
                });
            }
            setDltDialogOpen(false);
            setDeleting(false);
            setNewExams((prev) => prev.filter((ex) => ex.id !== selectedId));
        } catch (err) {
            console.error(err);
            if (soundEnabled) {
                playError();
            }
            toast.error("Failed to delete exam. Please try again later.", {
                duration: 2000,
            });
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        if (!selectedExam && newExams.length) {
            setSelectedExam(newExams[0]);
            return;
        }

        if (selectedExam && !newExams.some((ex) => ex.id === selectedExam.id)) {
            setSelectedExam(newExams[0] ?? null);
        }
    }, [newExams]);

    const getWeakTopics = (
        exam: NonNullable<DashboardUser>["exams"][number],
    ): WeakTopic[] => {
        const TOPIC_ACCURACY_THRESHOLD = 70;
        const RECENT_TEST_COUNT = 5;

        // Only consider the most recent attempted tests
        const recentTests = (exam.tests ?? [])
            .filter((test) => test.attempt)
            .sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
            .slice(0, RECENT_TEST_COUNT);

        const topicStats = new Map<
            number,
            {
                id: number;
                name: string;
                correctCount: number;
                wrongCount: number;
                tasks: {
                    id: number;
                    title: string;
                }[];
            }
        >();

        for (const test of recentTests) {
            if (!test.attempt) continue;

            const responses = test.attempt.responses as Record<string, string>;

            for (const question of test.questions) {
                const topic = question.topic;

                const userAnswer = responses[String(question.id)];

                let stats = topicStats.get(topic.id);

                if (!stats) {
                    stats = {
                        id: topic.id,
                        name: topic.name,
                        correctCount: 0,
                        wrongCount: 0,
                        tasks: topic.tasks,
                    };

                    topicStats.set(topic.id, stats);
                }

                if (userAnswer === question.correctAns) {
                    stats.correctCount++;
                } else {
                    stats.wrongCount++;
                }
            }
        }

        return (
            [...topicStats.values()]
                .map((topic) => {
                    const totalQuestions = topic.correctCount + topic.wrongCount;

                    const accuracy =
                        totalQuestions > 0
                            ? Math.round((topic.correctCount / totalQuestions) * 100)
                            : 0;

                    return {
                        ...topic,
                        totalQuestions,
                        accuracy,
                    };
                })
                // Only show topics that are currently weak
                .filter((topic) => topic.accuracy < TOPIC_ACCURACY_THRESHOLD)
                // Worst topics first
                .sort((a, b) => a.accuracy - b.accuracy || b.wrongCount - a.wrongCount)
        );
    };

    const weakTopics = selectedExam ? getWeakTopics(selectedExam) : [];

    return (
        <>
            {regenerating && (
                <div className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6 cursor-not-allowed">
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border text-center space-y-5">

                        <div className="text-sm text-justify tracking-tight text-gray-500 flex flex-col gap-y-2">
                            <span>
                                Hey {name?.split(" ")[0] || "there"} ! Your roadmap is being carefully built and may take around <span className="font-bold whitespace-nowrap">5-7</span> minutes as its a big responsible task. The app may seem hanged but it's not, don’t worry it’s still working in the background.
                            </span>
                            <span>
                                ☕️ Brew yourself a coffee, scroll for a while and let us handle the planning. We’ll let you know with a notification sound as soon as your roadmap is ready.
                            </span>
                        </div>

                        <div className="flex justify-center">
                            <div className="h-10 aspect-square rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                        </div>

                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                            <span>⏱️</span>
                            <span>
                                Time taking:{" "}
                                <span className="font-semibold text-gray-700">
                                    {formatTime(elapsedSeconds) + " >"}
                                </span>
                            </span>
                        </div>


                        <div className="space-y-2">
                            <h2 className="text-2xl font-semibold text-gray-800">
                                Generating Your Roadmap for {selectedExam?.exam.name}
                            </h2>

                            <p className="text-sm leading-relaxed text-gray-500">
                                {loadingMessage}
                            </p>
                        </div>

                        <div className="pt-3 space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Progress</span>
                                <span className="font-semibold text-blue-600">
                                    {progress}%
                                </span>
                            </div>

                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
                                    style={{
                                        width: `${progress}%`,
                                    }}
                                />
                            </div>
                        </div>

                        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                            <p className="text-sm text-blue-700 font-medium">
                                Please do not refresh or close this page.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <div className="space-y-8 md:pt-28 py-12 pt-30 px-6 md:px-12">
                <VisitMobile />

                {/* Header */}
                <div className="flex items-center gap-x-6">
                    <Image
                        src={dashboardUser?.image || "/avatar.png"}
                        width={60}
                        height={60}
                        alt="User"
                        className="rounded-full aspect-square w-10 md:w-15 object-cover object-center"
                    />
                    <div>
                        <h1 className="md:text-2xl tracking-wide text-xl font-bold">
                            Welcome,
                            <br />
                            <span className="text-emerald-600">
                                {dashboardUser?.name ?? "Student"}
                            </span>
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm">
                            Your Exam Analytics Dashboard
                        </p>
                    </div>
                </div>

                {/* Top Cards */}
                <div className="grid gap-6 grid-cols-2 xl:grid-cols-4">
                    {/* Exams */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0 }}
                    >
                        <Card className="relative h-full md flex flex-col py-4 md:py-6">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="md:text-xl text-sm font-semibold">
                                        Exams Enrolled
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-2 md:text-sm text-muted-foreground">
                                        Total exams you are enrolled in
                                    </CardDescription>
                                </div>

                                <BookOpen className="h-6 hidden md:block absolute top-5 right-5 text-emerald-600" />
                            </CardHeader>

                            <CardContent>
                                <div className="md:text-5xl text-3xl font-bold">
                                    {totalUserExams}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Progress */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.1 }}
                    >
                        <Card className="relative h-full flex flex-col py-4 md:py-6">
                            <CardHeader>
                                <CardTitle className="md:text-xl text-sm font-semibold">
                                    {currentSelectedExam?.exam.name || "Selected Exam"}
                                </CardTitle>
                                <CardDescription className="text-xs mt-2 md:text-sm text-muted-foreground">
                                    Your progress in this exam
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <div className="mb-3 flex md:flex-row flex-col items-center justify-between">
                                    <span className="text-xl md:text-3xl font-bold">
                                        {selectedProgress || 0}%
                                    </span>

                                    <span className="text-xs md:text-sm text-muted-foreground">
                                        Completed
                                    </span>
                                </div>

                                <Progress
                                    value={selectedProgress || 0}
                                    className="h-3 [&>div]:bg-emerald-600"
                                />
                            </CardContent>

                            <TrendingUp className="h-6 hidden md:block absolute top-5 right-5 text-emerald-600" />
                        </Card>
                    </motion.div>

                    {/* Roadmap */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.2 }}
                    >
                        <Card className="flex flex-col relative h-full py-4 md:py-6">
                            <CardHeader className="flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="md:text-xl text-sm font-semibold">
                                        Roadmap
                                    </CardTitle>

                                    <CardDescription className="text-xs md:text-sm text-muted-foreground mt-2">
                                        Your learning path
                                    </CardDescription>
                                </div>

                                <Route className="h-6 hidden md:block absolute top-5 right-5 text-blue-600" />
                            </CardHeader>

                            <CardContent className="px-4 md:px-6 mt-auto">
                                {!exam ? (
                                    <Link href="/onboarding">
                                        <Button className="w-full cursor-pointer">
                                            Create Roadmap
                                        </Button>
                                    </Link>
                                ) : roadmapStatus === RoadmapStatus.completed ? (
                                    <Link href={`/dashboard/roadmap/${selectedId}`}>
                                        <Button className="md:hidden w-full h-full text-xs md:text-sm cursor-pointer hover:bg-green-700 hover:text-white transition-colors duration-200">
                                            Open <br />
                                            Roadmap
                                        </Button>
                                        <Button className="hidden md:block w-full h-full text-xs md:text-sm cursor-pointer hover:bg-green-700 hover:text-white transition-colors duration-200">
                                            Open Roadmap
                                        </Button>
                                    </Link>
                                ) : roadmapStatus === RoadmapStatus.in_progress ? (
                                    <Button
                                        disabled
                                        className="w-full text-xs md:text-sm cursor-not-allowed bg-gray-300 text-gray-600"
                                    >
                                        ⏳ Generating...
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full text-xs md:text-sm cursor-pointer bg-red-700 hover:bg-red-600 text-white transition-colors duration-200"
                                        onClick={handleRegenerate}
                                    >
                                        🔁 Regenerate Roadmap
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Tests */}
                    <motion.div
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.3 }}
                    >
                        <Card className="flex flex-col relative h-full py-4 md:py-6">
                            <CardHeader className="flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="md:text-xl text-sm font-semibold">
                                        Practice Tests
                                    </CardTitle>

                                    <CardDescription className="text-xs md:text-sm text-muted-foreground mt-2">
                                        Evaluate your progress
                                    </CardDescription>
                                </div>

                                <ClipboardCheck className="h-6 hidden md:block absolute top-5 right-5 text-violet-600" />
                            </CardHeader>

                            <CardContent className="px-4 md:px-6 mt-auto">
                                <Link href={`/user-exam/${selectedId}/tests`}>
                                    <Button className="w-full text-xs md:text-sm cursor-pointer hover:bg-green-700 hover:text-white transition-colors duration-200">
                                        Give Tests
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Tabs */}
                <Tabs
                    value={selectedExam ? String(selectedExam.id) : "none"}
                    onValueChange={(v) => {
                        const selected = newExams.find((ex) => String(ex.id) === v);
                        setSelectedExam(selected ?? null);
                    }}
                    className="mt-6 p-4"
                >
                    <div className="flex items-center w-full justify-between">
                        <TabsList
                            className="
        
        justify-start
        gap-2
        overflow-x-auto
        rounded-xl
        p-1
        scrollbar-none
        md:flex-wrap
        md:overflow-visible
    "
                        >
                            {newExams.length > 0 ? (
                                newExams.map((ex) => (
                                    <TabsTrigger
                                        key={ex.id}
                                        value={String(ex.id)}
                                        className="
                    shrink-0
                    whitespace-nowrap
                    rounded-lg
                    px-4
                    py-2                    
                    font-semibold
                    capitalize
                    cursor-pointer
                    transition-all

                    data-[state=active]:bg-green-700
                    data-[state=active]:text-white
                    data-[state=active]:cursor-default

                    hover:bg-muted
                "
                                    >
                                        {ex.exam?.name ?? `Exam ${ex.id}`}
                                    </TabsTrigger>
                                ))
                            ) : (
                                <div className="p-2 text-sm text-muted-foreground">
                                    No exams added
                                </div>
                            )}
                        </TabsList>

                        <Button className="hidden md:block bg-transparent cursor-pointer border font-semibold text-green-700 border-green-600 hover:bg-green-800 text-sm hover:text-white hover:border-green-700 transition-colors duration-200">
                            <Link href="/dashboard/today">See Today's Tasks</Link>
                        </Button>
                    </div>

                    {/* NO EXAMS */}
                    {newExams.length === 0 ? (
                        <TabsContent value="none">
                            {/* 📱 MOBILE (ONLY PIE) */}
                            <div className="block md:hidden mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Exam Progress</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ChartContainer
                                            config={chartConfig}
                                            className="mx-auto aspect-square max-h-62.5 pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                                        >
                                            <PieChart>
                                                <ChartTooltip
                                                    content={<ChartTooltipContent hideLabel />}
                                                />

                                                <Pie
                                                    data={pieChartData}
                                                    dataKey="value"
                                                    nameKey="status"
                                                    label
                                                />
                                            </PieChart>
                                        </ChartContainer>
                                        <p className="text-center font-semibold text-lg">
                                            0% Completed
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* 🖥 DESKTOP (ALL EMPTY STATES) */}
                            <div className="hidden md:block">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Exam Progress</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer
                                                config={chartConfig}
                                                className="mx-auto aspect-square max-h-62.5 pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                                            >
                                                <PieChart>
                                                    <ChartTooltip
                                                        content={<ChartTooltipContent hideLabel />}
                                                    />

                                                    <Pie
                                                        data={pieChartData}
                                                        dataKey="value"
                                                        nameKey="status"
                                                        label
                                                    />
                                                </PieChart>
                                            </ChartContainer>
                                            <p className="text-center font-semibold text-lg">
                                                0% Completed
                                            </p>
                                        </CardContent>
                                    </Card>

                                    {/* Phase Progress Card */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Phase Progress</CardTitle>
                                        </CardHeader>

                                        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                                            <ChartContainer
                                                config={{
                                                    progress: {
                                                        label: "Progress",
                                                        color: "var(--chart-1)",
                                                    },
                                                }}
                                                className="aspect-auto h-62.5 w-full"
                                            >
                                                <BarChart
                                                    accessibilityLayer
                                                    data={phaseProgressData}
                                                    margin={{
                                                        left: 12,
                                                        right: 12,
                                                    }}
                                                >
                                                    <CartesianGrid vertical={false} />

                                                    <XAxis
                                                        dataKey="name"
                                                        tickLine={true}
                                                        axisLine={true}
                                                        tickMargin={8}
                                                    />

                                                    <YAxis
                                                        domain={[0, 100]}
                                                        tickLine={true}
                                                        axisLine={true}
                                                        tickMargin={8}
                                                    />

                                                    <ChartTooltip
                                                        cursor={{ fill: "rgba(34,197,94,0.1)" }} // soft green glow
                                                        content={
                                                            <ChartTooltipContent
                                                                className="w-37.5"
                                                                nameKey="progress"
                                                                labelFormatter={(value) => `Phase: ${value}`}
                                                                formatter={(value) => `${value}% completed`}
                                                            />
                                                        }
                                                    />

                                                    <Bar
                                                        dataKey="progress"
                                                        fill="var(--color-progress)"
                                                        radius={8}
                                                        activeBar={{
                                                            fill: "var(--color-progress-hover)",
                                                            opacity: 1,
                                                            stroke: "var(--color-progress-hover)",
                                                            strokeWidth: 2,
                                                        }}
                                                    />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>

                                        <CardFooter className="flex-col items-start gap-2 text-sm">
                                            <div className="flex gap-2 leading-none font-medium">
                                                Keep pushing — steady progress wins{" "}
                                                <TrendingUp className="h-4 w-4" />
                                            </div>
                                            <div className="leading-none text-muted-foreground">
                                                Each phase represents your learning milestone
                                            </div>
                                        </CardFooter>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Weekly Progress</CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                                            <ChartContainer
                                                config={{
                                                    progress: {
                                                        label: "Weekly Progress",
                                                        color: "var(--chart-1)",
                                                    },
                                                }}
                                                className="aspect-auto h-62.5 w-full"
                                            >
                                                <AreaChart data={weekProgressData}>
                                                    <defs>
                                                        <linearGradient
                                                            id="fillProgress"
                                                            x1="0"
                                                            y1="0"
                                                            x2="0"
                                                            y2="1"
                                                        >
                                                            <stop
                                                                offset="5%"
                                                                stopColor="var(--color-progress)"
                                                                stopOpacity={0.8}
                                                            />
                                                            <stop
                                                                offset="95%"
                                                                stopColor="var(--color-progress)"
                                                                stopOpacity={0.1}
                                                            />
                                                        </linearGradient>
                                                    </defs>

                                                    <CartesianGrid vertical={false} />

                                                    <XAxis
                                                        dataKey="name"
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={8}
                                                    />

                                                    <YAxis
                                                        domain={[0, 100]}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={8}
                                                    />

                                                    <ChartTooltip
                                                        cursor={false}
                                                        content={<ChartTooltipContent indicator="dot" />}
                                                    />

                                                    <Area
                                                        dataKey="progress"
                                                        type="natural"
                                                        fill="url(#fillProgress)"
                                                        stroke="var(--color-progress)"
                                                        strokeWidth={2}
                                                    />
                                                </AreaChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Milestone Chart</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer
                                                config={{
                                                    achieved: {
                                                        label: "Achieved",
                                                        color: "#22c55e",
                                                    },
                                                    pending: {
                                                        label: "Pending",
                                                        color: "#e5e7eb",
                                                    },
                                                }}
                                                className="aspect-auto h-62.5 w-full"
                                            >
                                                <BarChart
                                                    data={milestones.map((m: any) => ({
                                                        name: m.name ?? "Milestone",
                                                        achieved: m.achieved ? 100 : 0,
                                                        pending: m.achieved ? 0 : 100,
                                                    }))}
                                                    margin={{
                                                        left: 12,
                                                        right: 12,
                                                    }}
                                                >
                                                    <CartesianGrid vertical={false} />

                                                    <XAxis
                                                        dataKey="name"
                                                        tickLine={true}
                                                        axisLine={true}
                                                        tickMargin={8}
                                                    />

                                                    <YAxis
                                                        domain={[0, 100]}
                                                        tickLine={true}
                                                        axisLine={true}
                                                        tickMargin={8}
                                                    />

                                                    <ChartTooltip
                                                        cursor={{ fill: "rgba(34,197,94,0.1)" }} // soft green glow
                                                        content={
                                                            <ChartTooltipContent
                                                                className="w-37.5"
                                                                nameKey="name"
                                                                formatter={(value) => `${value} milestone`}
                                                            />
                                                        }
                                                    />

                                                    <Bar dataKey="achieved" fill="#22c55e" radius={8} />
                                                    <Bar dataKey="pending" fill="#e5e7eb" radius={8} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                <h2 className="text-xl font-bold mt-10 mb-4">Milestones</h2>
                                <div className="text-sm text-muted-foreground">
                                    No milestones yet.
                                </div>
                            </div>
                        </TabsContent>
                    ) : (
                        newExams.map((ex) => (
                            <TabsContent key={ex.id} value={String(ex.id)}>
                                {/* 📱 MOBILE */}
                                <div className="block md:hidden mt-6 ">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Exam Progress</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer
                                                config={chartConfig}
                                                className="mx-auto aspect-square max-h-62.5 pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                                            >
                                                <PieChart>
                                                    <ChartTooltip
                                                        content={<ChartTooltipContent hideLabel />}
                                                    />

                                                    <Pie
                                                        data={pieChartData}
                                                        dataKey="value"
                                                        nameKey="status"
                                                        label
                                                    />
                                                </PieChart>
                                            </ChartContainer>

                                            <p className="text-center font-semibold ">
                                                {ex.progress_percent ?? 0}% Completed
                                            </p>
                                        </CardContent>
                                        <CardFooter className="flex-col items-start gap-4 text-xs">
                                            <div className="flex gap-2 leading-none font-medium">
                                                {(ex.progress_percent ?? 0) >= 70
                                                    ? "Strong progress - you're close to the finish line"
                                                    : (ex.progress_percent ?? 0) >= 40
                                                        ? "Good pace - stay consistent"
                                                        : "Just getting started - build the habit"}
                                                <TrendingUp className="h-4 w-4" />
                                            </div>
                                            <div className="leading-none text-muted-foreground">
                                                {ex.progress_percent ?? 0}% of your exam journey is
                                                complete
                                            </div>
                                        </CardFooter>
                                    </Card>

                                    <Card className="mt-6">
                                        <CardHeader>
                                            <CardTitle>Phase Progress</CardTitle>
                                        </CardHeader>

                                        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                                            <ChartContainer
                                                config={{
                                                    progress: {
                                                        label: "Progress",
                                                        color: "#22c55e",
                                                    },
                                                }}
                                                className="aspect-auto h-62.5 w-full"
                                            >
                                                <BarChart
                                                    accessibilityLayer
                                                    data={phaseProgressData}
                                                    margin={{
                                                        left: 12,
                                                        right: 12,
                                                    }}
                                                >
                                                    <CartesianGrid vertical={false} />

                                                    <XAxis
                                                        dataKey="name"
                                                        tickLine={true}
                                                        axisLine={true}
                                                        tickMargin={8}
                                                    />

                                                    <YAxis
                                                        domain={[0, 100]}
                                                        tickLine={true}
                                                        axisLine={true}
                                                        tickMargin={8}
                                                    />

                                                    <ChartTooltip
                                                        cursor={{ fill: "rgba(34,197,94,0.1)" }} // soft green glow
                                                        content={
                                                            <ChartTooltipContent
                                                                className="w-40 text-[10px] p-4"
                                                                nameKey="progress"
                                                                labelFormatter={(value) => `Phase: ${value}`}
                                                                formatter={(value) => `${value}% completed`}
                                                            />
                                                        }
                                                    />

                                                    <Bar
                                                        dataKey="progress"
                                                        fill="#22c55e"
                                                        radius={8}
                                                        activeBar={{
                                                            fill: "#16a34a",
                                                            opacity: 1,
                                                            stroke: "#16a34a",
                                                            strokeWidth: 2,
                                                        }}
                                                    />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                        <CardFooter className="flex-col items-start gap-4 text-xs">
                                            <div className="flex gap-2 leading-none font-medium">
                                                Your weekly effort is shaping your progress{" "}
                                                <TrendingUp className="h-4 w-4" />
                                            </div>
                                            <div className="leading-none text-muted-foreground">
                                                Track how consistently you’re improving week by week
                                            </div>
                                        </CardFooter>
                                    </Card>
                                </div>

                                {/* 🖥 DESKTOP */}
                                <div className="hidden md:block">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                        {/* Pie */}
                                        <motion.div
                                            className="h-full"
                                            initial={{ opacity: 0, x: -50 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.45, delay: 0.5 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader>
                                                    <CardTitle>
                                                        {currentSelectedExam?.exam.name} Exam Progress
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <ChartContainer
                                                        config={chartConfig}
                                                        className="mx-auto aspect-square max-h-62.5 pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                                                    >
                                                        <PieChart>
                                                            <ChartTooltip
                                                                content={<ChartTooltipContent hideLabel />}
                                                            />

                                                            <Pie
                                                                data={pieChartData}
                                                                dataKey="value"
                                                                nameKey="status"
                                                                label
                                                            />
                                                        </PieChart>
                                                    </ChartContainer>
                                                    <p className="text-center font-semibold text-lg">
                                                        {ex.progress_percent ?? 0}% Completed
                                                    </p>
                                                </CardContent>
                                                <CardFooter className="flex-col items-start gap-2 text-sm">
                                                    <div className="flex gap-2 leading-none font-medium">
                                                        {(ex.progress_percent ?? 0) >= 70
                                                            ? "Strong progress — you're close to the finish line"
                                                            : (ex.progress_percent ?? 0) >= 40
                                                                ? "Good pace — stay consistent"
                                                                : "Just getting started — build the habit"}
                                                        <TrendingUp className="h-4 w-4" />
                                                    </div>
                                                    <div className="leading-none text-muted-foreground">
                                                        {ex.progress_percent ?? 0}% of your exam journey is
                                                        complete
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        </motion.div>

                                        {/* Phase Progress Bar Chart */}
                                        <motion.div
                                            className="h-full"
                                            initial={{ opacity: 0, x: 50 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.45, delay: 0.5 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader>
                                                    <CardTitle>Phase Progress</CardTitle>
                                                    <CardDescription>
                                                        Progress across all phases
                                                    </CardDescription>
                                                </CardHeader>

                                                <CardContent>
                                                    <ChartContainer
                                                        config={{
                                                            progress: {
                                                                label: "Progress",
                                                                color: "#22c55e",
                                                            },
                                                        }}
                                                        className="aspect-auto h-62.5 w-full"
                                                    >
                                                        <BarChart
                                                            accessibilityLayer
                                                            data={phaseProgressData}
                                                            margin={{
                                                                left: 12,
                                                                right: 12,
                                                            }}
                                                        >
                                                            <CartesianGrid vertical={false} />

                                                            <XAxis
                                                                dataKey="name"
                                                                tickLine={true}
                                                                axisLine={true}
                                                                tickMargin={8}
                                                            />

                                                            <YAxis
                                                                domain={[0, 100]}
                                                                tickLine={true}
                                                                axisLine={true}
                                                                tickMargin={8}
                                                            />

                                                            <ChartTooltip
                                                                cursor={{ fill: "rgba(34,197,94,0.1)" }} // soft green glow
                                                                content={
                                                                    <ChartTooltipContent
                                                                        className="w-37.5"
                                                                        nameKey="progress"
                                                                        labelFormatter={(value) =>
                                                                            `Phase: ${value}`
                                                                        }
                                                                        formatter={(value) => `${value}% completed`}
                                                                    />
                                                                }
                                                            />

                                                            <Bar
                                                                dataKey="progress"
                                                                fill="#22c55e"
                                                                radius={8}
                                                                activeBar={{
                                                                    fill: "#16a34a",
                                                                    opacity: 1,
                                                                    stroke: "#16a34a",
                                                                    strokeWidth: 2,
                                                                }}
                                                            />
                                                        </BarChart>
                                                    </ChartContainer>
                                                </CardContent>

                                                <CardFooter className="flex-col items-start gap-2 text-sm">
                                                    <div className="flex gap-2 leading-none font-medium">
                                                        Keep pushing — steady progress wins{" "}
                                                        <TrendingUp className="h-4 w-4" />
                                                    </div>
                                                    <div className="leading-none text-muted-foreground">
                                                        Each phase represents your learning milestone
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        </motion.div>

                                        {/* Weekly area chart */}
                                        <motion.div
                                            className="h-full col-span-2"
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.45, delay: 0.5 }}
                                        >
                                            <Card className="col-span-2 h-full">
                                                <CardHeader>
                                                    <CardTitle>Weekly Progress</CardTitle>
                                                </CardHeader>
                                                <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                                                    <ChartContainer
                                                        config={{
                                                            progress: {
                                                                label: "Weekly Progress",
                                                                color: "#22c55e",
                                                            },
                                                        }}
                                                        className="aspect-auto h-62.5 w-full"
                                                    >
                                                        <AreaChart data={weekProgressData}>
                                                            <defs>
                                                                <linearGradient
                                                                    id="fillProgress"
                                                                    x1="0"
                                                                    y1="0"
                                                                    x2="0"
                                                                    y2="1"
                                                                >
                                                                    <stop
                                                                        offset="5%"
                                                                        stopColor="var(--color-progress)"
                                                                        stopOpacity={0.8}
                                                                    />
                                                                    <stop
                                                                        offset="95%"
                                                                        stopColor="var(--color-progress)"
                                                                        stopOpacity={0.1}
                                                                    />
                                                                </linearGradient>
                                                            </defs>

                                                            <CartesianGrid vertical={false} />

                                                            <XAxis
                                                                dataKey="week"
                                                                tickLine={false}
                                                                axisLine={false}
                                                                tickMargin={8}
                                                            />

                                                            <YAxis
                                                                domain={[0, 100]}
                                                                tickLine={true}
                                                                axisLine={true}
                                                                tickMargin={8}
                                                            />

                                                            <ChartTooltip
                                                                cursor={true}
                                                                content={
                                                                    <ChartTooltipContent
                                                                        indicator="dot"
                                                                        labelFormatter={(value) =>
                                                                            `Week: ${value.replace("W", "")}`
                                                                        }
                                                                    />
                                                                }
                                                            />
                                                            <ChartLegend content={<ChartLegendContent />} />
                                                            <Area
                                                                dataKey="progress"
                                                                type="natural"
                                                                fill="url(#fillProgress)"
                                                                stroke="var(--color-progress)"
                                                                strokeWidth={2}
                                                            />
                                                        </AreaChart>
                                                    </ChartContainer>
                                                </CardContent>
                                                <CardFooter className="flex-col items-start gap-2 text-sm">
                                                    <div className="flex gap-2 leading-none font-medium">
                                                        Your weekly effort is shaping your progress{" "}
                                                        <TrendingUp className="h-4 w-4" />
                                                    </div>
                                                    <div className="leading-none text-muted-foreground">
                                                        Track how consistently you’re improving week by week
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        </motion.div>

                                        {/* Milestones Cards */}

                                        <motion.div
                                            className="h-full col-span-3"
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.45, delay: 0.3 }}
                                        >
                                            <Card className="h-full col-span-3 grid grid-cols-1 md:grid-cols-3 gap-5 p-6">
                                                <CardHeader className="col-span-3">
                                                    <CardTitle>Milestones</CardTitle>
                                                    <CardDescription>
                                                        Track your key achievements
                                                    </CardDescription>
                                                </CardHeader>

                                                {milestones.map((m: any) => {
                                                    const isDone = m.achieved;

                                                    return (
                                                        <Card
                                                            key={m.id}
                                                            className={`
        group relative overflow-hidden border
        transition-all duration-300
        hover:-translate-y-1 hover:shadow-xl
        ${isDone
                                                                    ? "border-green-200 bg-linear-to-br from-green-50 via-white to-emerald-50/50"
                                                                    : "border-gray-200 bg-linear-to-br from-white via-white to-gray-50"
                                                                }
    `}
                                                        >


                                                            <CardHeader className=" pl-5">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0 flex flex-col gap-3 ">

                                                                        <CardTitle className="line-clamp-1 text-base font-semibold tracking-tight">
                                                                            {m.name}
                                                                        </CardTitle>


                                                                        {/* Status Badge */}
                                                                        <Badge className={`
                                                                        text-xs font-medium
                                                                        ${isDone ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
                                                                    `}>
                                                                            {isDone ? "Completed" : "In Progress"}
                                                                        </Badge>

                                                                    </div>

                                                                    {/* Status Icon */}
                                                                    <div
                                                                    >
                                                                        {isDone ? "✓" : "⏳"}
                                                                    </div>
                                                                </div>
                                                            </CardHeader>

                                                            <CardContent className="space-y-4 pl-5">
                                                                {/* Goal */}
                                                                {m.goal && (
                                                                    <div>
                                                                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                            Goal :
                                                                        </p>

                                                                        <p className="line-clamp-2 text-sm leading-relaxed">
                                                                            {m.goal}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Divider */}
                                                                <div className="h-px bg-border/60" />

                                                                {/* Footer */}
                                                                <div className="flex items-center justify-between gap-3">
                                                                    {/* Target Date */}
                                                                    {m.target_date ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="mr-2">
                                                                                📅
                                                                            </div>

                                                                            <div>
                                                                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                                    Target date :
                                                                                </p>

                                                                                <p className="text-xs font-semibold text-foreground">
                                                                                    {format(
                                                                                        new Date(m.target_date),
                                                                                        "MMM dd, yyyy",
                                                                                    )}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            No target date
                                                                        </span>
                                                                    )}

                                                                    {/* Meta */}
                                                                    <span>
                                                                        🏹
                                                                    </span>

                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}

                                                <CardFooter className="col-span-3 flex-col items-start gap-2 mt-4 text-sm">
                                                    <div className="flex gap-2 leading-none font-medium">
                                                        Milestones are your stepping stones to success{" "}
                                                        <Sparkles className="h-4 w-4" />
                                                    </div>
                                                    <div className="leading-none text-muted-foreground">
                                                        Celebrate each achievement as you progress through
                                                        your exam journey
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        </motion.div>
                                    </div>

                                    {/* Performance Cards */}

                                    <h1 className="text-2xl font-bold mt-10 mb-6">
                                        Performance Overview
                                    </h1>

                                    {/* Performance cards 1 */}
                                    <div className="grid gap-6 md:grid-cols-4">
                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.5 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Performance Score
                                                        </CardTitle>
                                                        <CardDescription>Overall readiness</CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-950">
                                                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold text-emerald-600">
                                                        {performanceScore}%
                                                    </div>

                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Based on your latest performance
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.7 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Highest Score
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Best test performance
                                                        </CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-950">
                                                        <Award className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold text-blue-600">
                                                        {highestScore}%
                                                    </div>

                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Your personal best
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.9 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Lowest Score
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Room for improvement
                                                        </CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-950">
                                                        <TrendingDown className="h-5 w-5 text-orange-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold text-orange-600">
                                                        {lowestScore}%
                                                    </div>

                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Lowest recorded score
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.5 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Last Test
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Most recent attempt
                                                        </CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-950">
                                                        <Clock3 className="h-5 w-5 text-violet-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold text-violet-600">
                                                        {lastTestScore}%
                                                    </div>

                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Latest recorded score
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    </div>

                                    {/* Performance cards 2 */}
                                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 mt-6">
                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.5 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Generated Tests
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Total AI generated tests
                                                        </CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-900">
                                                        <FileText className="h-5 w-5 text-slate-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold">
                                                        {testsGenerated}
                                                    </div>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {totalTests} total tests available
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.7 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Attempted
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Tests you've completed
                                                        </CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950">
                                                        <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold text-indigo-600">
                                                        {testsAttempted}
                                                    </div>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {totalTests > 0
                                                            ? `${Math.round((testsAttempted / totalTests) * 100)}% completed`
                                                            : "No tests yet"}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.9 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Passed
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Successfully cleared
                                                        </CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-green-100 p-2 dark:bg-green-950">
                                                        <BadgeCheck className="h-5 w-5 text-green-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold text-green-600">
                                                        {testsPassed}
                                                    </div>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {testsAttempted > 0
                                                            ? `${Math.round((testsPassed / testsAttempted) * 100)}% pass rate`
                                                            : "No attempts yet"}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, y: 25 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 1.1 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <div>
                                                        <CardTitle className="mb-2 font-semibold">
                                                            Failed
                                                        </CardTitle>
                                                        <CardDescription>Tests to improve</CardDescription>
                                                    </div>

                                                    <div className="rounded-lg bg-red-100 p-2 dark:bg-red-950">
                                                        <CircleX className="h-5 w-5 text-red-600" />
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="text-3xl font-bold text-red-600">
                                                        {testsFailed}
                                                    </div>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {testsAttempted > 0
                                                            ? `${Math.round((testsFailed / testsAttempted) * 100)}% failure rate`
                                                            : "No attempts yet"}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    </div>

                                    {/* Performance Charts */}
                                    <div className="grid gap-6 md:grid-cols-2 mt-6">
                                        <motion.div
                                            initial={{ opacity: 0, x: -50 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.5 }}
                                        >
                                            <Card className="">
                                                <CardHeader>
                                                    <CardTitle>Performance Trend</CardTitle>
                                                    <CardDescription>
                                                        Score progression across all tests
                                                    </CardDescription>
                                                </CardHeader>

                                                <CardContent>
                                                    <ChartContainer
                                                        config={performanceChartConfig}
                                                        className="h-75 w-full"
                                                    >
                                                        <LineChart
                                                            accessibilityLayer
                                                            data={
                                                                performanceTrend.length > 0
                                                                    ? performanceTrend
                                                                    : [{ test: "No Data", score: 0, type: "N/A" }]
                                                            }
                                                        >
                                                            <CartesianGrid vertical={true} />

                                                            <XAxis
                                                                dataKey="test"
                                                                tickLine={true}
                                                                axisLine={true}
                                                            />

                                                            <YAxis
                                                                domain={[0, 100]}
                                                                tickLine={true}
                                                                axisLine={true}
                                                            />

                                                            <ChartTooltip
                                                                cursor={true}
                                                                content={<ChartTooltipContent />}
                                                            />

                                                            <Line
                                                                dataKey="score"
                                                                type="monotone"
                                                                stroke="var(--color-score)"
                                                                strokeWidth={3}
                                                                dot={{
                                                                    r: 7,
                                                                    fill: "var(--color-score)",
                                                                    stroke: "var(--color-score)",
                                                                }}
                                                                activeDot={{
                                                                    r: 7,
                                                                    fill: "#16a34a",
                                                                    stroke: "var(--color-score)",
                                                                }}
                                                            />
                                                            <Line
                                                                dataKey="type"
                                                                type="monotone"
                                                                stroke="var(--color-type)"
                                                                strokeWidth={3}
                                                                dot={{
                                                                    r: 5,
                                                                }}
                                                                activeDot={{
                                                                    r: 7,
                                                                }}
                                                            />
                                                        </LineChart>
                                                    </ChartContainer>
                                                </CardContent>
                                                <CardFooter className="flex-col items-start gap-2 text-sm">
                                                    <div className="flex gap-2 leading-none font-medium">
                                                        Your performance trend over time{" "}
                                                        <TrendingUp className="h-4 w-4" />
                                                    </div>
                                                    <div className="leading-none text-muted-foreground">
                                                        Track your score progression across all tests
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        </motion.div>

                                        {/* Pass Fail Pie Chart */}
                                        <motion.div
                                            initial={{ opacity: 0, x: 50 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.2, delay: 0.7 }}
                                        >
                                            <Card className="h-full">
                                                <CardHeader>
                                                    <CardTitle>Pass Rate</CardTitle>
                                                    <CardDescription className="text-xs mt-2 md:text-sm text-muted-foreground">
                                                        Your overall test performance distribution
                                                    </CardDescription>
                                                </CardHeader>

                                                <CardContent>
                                                    <ChartContainer
                                                        config={pfChartConfig}
                                                        className="mx-auto aspect-square max-h-62.5 pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                                                    >
                                                        <PieChart>
                                                            <ChartTooltip
                                                                content={<ChartTooltipContent hideLabel />}
                                                            />

                                                            <Pie
                                                                data={pfPieChartData}
                                                                dataKey="value"
                                                                nameKey="status"
                                                                label={({ percent }) =>
                                                                    `${((percent ?? 0) * 100).toFixed(0)}%`
                                                                }
                                                            />
                                                        </PieChart>
                                                    </ChartContainer>

                                                    <p className="text-center text-lg font-semibold">
                                                        {testsAttempted > 0
                                                            ? `${Math.round((testsPassed / testsAttempted) * 100)}%`
                                                            : "0%"}{" "}
                                                        Passing Rate
                                                    </p>
                                                </CardContent>

                                                <CardFooter className="flex-col items-start gap-2 text-sm">
                                                    <div className="flex gap-2 leading-none font-medium">
                                                        {(pfPieChartData[0]?.value ?? 0) >= 70
                                                            ? "Strong progress — you're close to the finish line"
                                                            : (pfPieChartData[0]?.value ?? 0) >= 40
                                                                ? "Good pace — stay consistent"
                                                                : "Just getting started — build the habit"}
                                                        <TrendingUp className="h-4 w-4" />
                                                    </div>
                                                    <div className="leading-none text-muted-foreground">
                                                        {pfPieChartData[0]?.value ?? 0}% of your exam
                                                        journey is complete
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        </motion.div>
                                    </div>

                                    {/* Weak Topics */}
                                    <Card className="mt-6">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                🎯 Topics to Improve
                                            </CardTitle>

                                            <CardDescription>
                                                Based on your performance in your most recent tests.
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            {weakTopics.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                                    {testsAttempted === 0 ? (
                                                        <>
                                                            <p className="text-sm font-medium">
                                                                No Tests have been attempted yet.
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Start attempting tests to identify areas for
                                                                improvement.
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-sm font-medium">
                                                                Great job! You haven't answered any questions
                                                                incorrectly yet.
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Great job! You haven't answered any questions
                                                                incorrectly yet.
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {weakTopics.slice(0, 5).map((topic) => (
                                                        <div
                                                            key={topic.id}
                                                            className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                                                        >
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-6">
                                                                    <h4 className="font-medium">{topic.name}</h4>

                                                                    <div className="flex items-center gap-2">
                                                                        <Badge
                                                                            variant="destructive"
                                                                            className="text-[10px] font-medium px-2 py-1"
                                                                        >
                                                                            {topic.accuracy}% Accuracy
                                                                        </Badge>

                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-[10px] font-normal px-2 py-1"
                                                                        >
                                                                            {topic.wrongCount} wrong
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                <span className="text-sm font-medium text-muted-foreground">
                                                                    From Task :
                                                                    {topic.tasks.map((task, index) => (
                                                                        <span
                                                                            className=" font-normal"
                                                                            key={task.id}
                                                                        >
                                                                            {" " + task.title}
                                                                        </span>
                                                                    ))}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className="flex items-center font-medium text-sm text-muted-foreground">
                                            💡 These aren't permanent. Keep practicing, take more
                                            tests, and watch your weak topics improve or disappear.
                                        </CardFooter>
                                    </Card>

                                    {/* Performance Summary */}

                                    <h1 className="text-2xl font-bold mt-12 mb-6">
                                        Your {selectedExam?.exam.name} Summary
                                    </h1>
                                    <motion.div
                                        initial={{ opacity: 0, y: 25 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.2, delay: 0.5 }}
                                    >
                                        <Card className="h-full">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Sparkles className="h-5 w-5 text-emerald-600" />A
                                                    quick overview of your current progress and
                                                    performance.
                                                </CardTitle>
                                            </CardHeader>

                                            <CardContent className="space-y-6">
                                                <div className="space-y-4">
                                                    <div className="flex items-start gap-3">
                                                        <TrendingUp className="mt-1 h-4 w-4 text-emerald-600" />
                                                        <div>
                                                            <p className="font-medium">Overall Performance</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {overallPerformanceSummary}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div className="flex items-start gap-3">
                                                        <Route className="mt-1 h-4 w-4 text-blue-600" />
                                                        <div>
                                                            <p className="font-medium">Roadmap Progress</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {roadmapSummary}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div className="flex items-start gap-3">
                                                        <ClipboardCheck className="mt-1 h-4 w-4 text-violet-600" />
                                                        <div>
                                                            <p className="font-medium">Tests</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {testsSummary}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div className="flex items-start gap-3">
                                                        <BadgeCheck className="mt-1 h-4 w-4 text-green-600" />
                                                        <div>
                                                            <p className="font-medium">Pass Rate</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {passRateSummary}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div className="flex items-start gap-3">
                                                        <Clock3 className="mt-1 h-4 w-4 text-orange-600" />
                                                        <div>
                                                            <p className="font-medium">Latest Performance</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {latestPerformanceSummary}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border bg-muted/40 p-4">
                                                    <div className="mb-3 flex items-center gap-2">
                                                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                                                        <h4 className="font-semibold">Suggestions</h4>
                                                    </div>

                                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                                        {suggestions.map((suggestion, index) => (
                                                            <li
                                                                key={index}
                                                                className="flex items-start gap-2"
                                                            >
                                                                <span className="mt-1 text-yellow-500">💡</span>
                                                                {suggestion}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>

                                    {/* DELETE EXAM */}
                                    <motion.section
                                        initial={{ opacity: 0, y: 25 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, amount: 0.2 }}
                                        transition={{ duration: 0.5 }}
                                        className="mt-16 mx-auto border rounded-2xl border-red-200 p-6 shadow-sm transition-all duration-300 hover:shadow-xl"
                                    >
                                        <div className="flex flex-col gap-3 mb-6">
                                            <h2 className="text-2xl font-bold text-red-600">
                                                Danger Zone
                                            </h2>

                                            <p className="text-sm text-muted-foreground">
                                                Permanent actions that cannot be undone.
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-red-200 bg-linear-to-r from-white to-red-50 p-6 shadow-sm transition-all duration-300 hover:shadow-xl">
                                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                                <div className="flex items-start gap-5">
                                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
                                                        <Trash2 className="h-7 w-7 text-red-600" />
                                                    </div>

                                                    <div>
                                                        <h3 className="text-lg font-semibold text-red-700">
                                                            Delete {exam?.exam?.name ?? ""} Exam
                                                        </h3>

                                                        <p className="mt-2 max-w-xl text-sm text-gray-500">
                                                            Permanently remove this exam, its roadmap,
                                                            progress, milestones, and associated learning
                                                            data. This action cannot be reversed.
                                                        </p>
                                                    </div>
                                                </div>

                                                <Dialog
                                                    open={dltDialogOpen}
                                                    onOpenChange={setDltDialogOpen}
                                                >
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            className="cursor-pointer text-base font-semibold rounded-lg bg-transparent border border-red-600 hover:bg-red-700 px-6 py-2 text-red-600 hover:text-white transition-all duration-300"
                                                            disabled={deleting}
                                                            onClick={() => setDltDialogOpen(true)}
                                                        >
                                                            {deleting ? "Deleting..." : "Delete Exam"}
                                                        </Button>
                                                    </DialogTrigger>

                                                    <DialogContent className="sm:max-w-md rounded-2xl">
                                                        <DialogHeader>
                                                            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                                                                <TriangleAlert className="h-8 w-8 text-red-600" />
                                                            </div>

                                                            <DialogTitle className="text-center text-red-600">
                                                                Delete Exam?
                                                            </DialogTitle>

                                                            <DialogDescription className="text-center">
                                                                {deleting ? (
                                                                    <span className="flex items-center justify-center gap-2 font-medium text-black">
                                                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                                                        Deleting {exam?.exam?.name ?? "this exam"}
                                                                        ...
                                                                    </span>
                                                                ) : (
                                                                    <>
                                                                        You are about to permanently delete{" "}
                                                                        <span className="font-semibold text-black">
                                                                            {exam?.exam?.name ?? "this exam"}
                                                                        </span>
                                                                        .
                                                                        <br />
                                                                        This action cannot be undone.
                                                                    </>
                                                                )}
                                                            </DialogDescription>
                                                        </DialogHeader>

                                                        <DialogFooter className="mt-6">
                                                            <DialogClose asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    className="cursor-pointer"
                                                                    disabled={deleting}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </DialogClose>

                                                            <Button
                                                                variant="destructive"
                                                                onClick={handleDelete}
                                                                disabled={deleting}
                                                                className="cursor-pointer"
                                                            >
                                                                {deleting ? "Deleting..." : "Yes, Delete"}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </motion.section>
                                </div>
                            </TabsContent>
                        ))
                    )}
                </Tabs>

                <p className=" block md:hidden text-sm mt-4 bg-yellow-300 p-3 rounded-lg">
                    ❗️ For full analytics, please access the dashboard on a desktop
                    device. 📊
                </p>
            </div>
        </>
    );
}
