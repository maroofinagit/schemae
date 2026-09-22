'use client';

import { useEffect, useRef, useState } from 'react';
import { addYears, format, addMonths, subYears, differenceInDays, differenceInMonths } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { createUserExam } from '@/app/actions/action';
import { playError, playNotification } from '@/app/lib/sound';
import { useUser } from '@/app/context/userContext';


export default function ClientExamStart({ exam }: { exam: any }) {

    const { soundEnabled } = useUser();
    const [loading, setLoading] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const messageLoopRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    const today = new Date();
    const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(addMonths(today, 6), 'yyyy-MM-dd'));
    const minStartDate = format(subYears(new Date(startDate), 3), 'yyyy-MM-dd');
    const minEndDate = format(addMonths(new Date(startDate), 3), "yyyy-MM-dd");
    const maxEndDate = format(addYears(new Date(startDate), 3), "yyyy-MM-dd");

    const getPreparationDuration = () => {
        if (!startDate || !endDate) return null;

        const start = new Date(startDate);
        const end = new Date(endDate);

        const months = differenceInMonths(end, start);
        const remainingDays = differenceInDays(end, addMonths(start, months));

        if (months === 0) {
            return `${remainingDays} day${remainingDays !== 1 ? "s" : ""}`;
        }

        if (remainingDays === 0) {
            return `${months} month${months !== 1 ? "s" : ""}`;
        }

        return `${months} month${months !== 1 ? "s" : ""} ${remainingDays} day${remainingDays !== 1 ? "s" : ""}`;
    };

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

    async function handleStartPreparing(
        event: React.SubmitEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const formData = new FormData(event.currentTarget);

            const startDate =
                formData.get("start_date") as string;

            const endDate =
                formData.get("end_date") as string;

            // 1️⃣ Create User Exam
            setLoadingMessage("Creating your user exam...");

            const userExamRes = await createUserExam({
                examId: exam.id,
                start_date: startDate,
                end_date: endDate,
            });

            if (!userExamRes.success) {
                throw new Error("Failed to create user exam");
            }

            const { user_exam_id } = userExamRes;

            if (user_exam_id === undefined) {
                throw new Error("User exam ID is undefined");
            }

            setLoadingMessage(
                "✅ User exam created successfully!"
            );
            setProgress(5);

            await new Promise((r) =>
                setTimeout(r, 1000)
            );

            const eventSource = new EventSource(
                `/api/roadmap/stream?userExamId=${user_exam_id}`
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

                // Progress update
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
                        "Roadmap generated successfully!"
                    );

                    setLoadingMessage(
                        "🎯 Roadmap ready! Redirecting to your dashboard..."
                    );

                    setTimeout(() => {
                        router.replace(
                            `/dashboard/roadmap/${user_exam_id}`
                        );
                    }, 1000);
                    setLoading(false);
                }

                // Generation failed
                if (data.type === "error") {
                    eventSource.close();

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

                setLoadingMessage(
                    "Connection lost. Redirecting to dashboard..."
                );

                setProgress(0);

                setTimeout(() => {
                    router.replace("/dashboard");
                }, 3000);

            };

        }

        catch (err: any) {
            console.error(err);

            if (soundEnabled) {
                playError();
            }

            toast.error(
                "Sorry, something went wrong. Please try again later.",
                {
                    duration: 2000,
                }
            );

            setError(
                "Sorry, something went wrong. Please try again later."
            );

            setTimeout(() => {
                router.replace("/dashboard");
            }, 2000);

            setProgress(0);

            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loading) {
            setElapsedSeconds(0);
            return;
        }

        const interval = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [loading]);

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${remainingSeconds
            .toString()
            .padStart(2, "0")}`;
    };

    const { name } = useUser();

    return (
        <>
            {
                loading && (
                    <div className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6 cursor-not-allowed">
                        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border text-center space-y-5">

                            <div className="text-sm text-justify tracking-tight text-gray-500 flex flex-col gap-y-2">

                                <span>
                                    Hey {name?.split(" ")[0] || "there"} ! Your roadmap is being carefully built for your selected timeline from{" "}
                                    {format(new Date(startDate), "MMM d, yyyy")}
                                    {" "}
                                    to{" "}
                                    {format(new Date(endDate), "MMM d, yyyy")}{" "}
                                    ({getPreparationDuration()}) and may take around{" "}
                                    <span className="font-bold whitespace-nowrap">5-7</span>{" "}
                                    minutes as its a big responsible task. The app may seem hanged but it's not, don’t worry it’s still working in the background.
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
                                    Generating Your Roadmap for {exam.name}
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
                )
            }

            <div className="md:hidden relative min-h-screen pt-16 px-6 flex-col flex items-center justify-center overflow-hidden bg-[#ffffff]">
                <p className="text-gray-700 text-sm md:text-base text-center px-4">
                    ⚠️ This feature is only available on desktop. Please switch to a desktop device to start preparing for your exam.
                </p>
            </div>

            <div className="hidden relative min-h-screen pt-16 flex-col md:flex items-center justify-center overflow-hidden bg-[#ffffff]">

                {/* 🌤️ Soft Glow Background */}
                <div className="absolute inset-0">
                    <div className="absolute w-150 h-150 bg-emerald-200/50 rounded-full blur-3xl -top-37.5 -left-37.5" />
                    <div className="absolute w-125 h-125 bg-blue-200/50 rounded-full blur-3xl -bottom-37.5 -right-37.5" />
                    <div className="absolute w-100 h-100 bg-purple-200/50 rounded-full blur-3xl top-[40%] left-[35%]" />
                </div>

                <div className="relative z-10 max-w-2xl text-center px-4 mb-12">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Start Preparing for Your Exam</h1>
                    {error ? (
                        <p className="text-gray-700 text-sm md:text-base">
                            ⚠️ {error}
                        </p>
                    ) : (
                        <p className="text-gray-700 text-sm md:text-base">
                            Choose a start date from which you want to begin your preparation and end date till which you want to complete it. We will create a personalized roadmap for you based on this timeline. Don’t worry, you can adjust your timeline later if needed!
                        </p>
                    )}

                </div>

                {/* 🌿 Center Card */}
                <div className="relative z-10 w-full max-w-md md:max-w-2xl mx-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8">

                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-lg md:text-2xl font-semibold text-gray-900 tracking-tight">
                                {exam.name}
                            </h1>

                            <div className="mt-2 space-y-2">
                                <p className="text-sm md:text-base text-gray-600">
                                    Set your timeline and begin your preparation journey.
                                </p>

                                <p className="text-xs md:text-sm text-gray-500">
                                    Minimum 3 months and maximum 3 years.
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleStartPreparing} className="space-y-5">

                            {/* Start Date */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                                    Start Date
                                </label>

                                <input
                                    type="date"
                                    name="start_date"
                                    min={minStartDate}
                                    max={format(addYears(new Date(), 3), "yyyy-MM-dd")}
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800
                    focus:ring-2 focus:ring-black focus:bg-white focus:border-gray-400
                    outline-none transition"
                                />
                            </div>

                            {/* End Date */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                                    Target Completion Date
                                </label>

                                <input
                                    type="date"
                                    name="end_date"
                                    min={minEndDate}
                                    max={maxEndDate}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800
                    focus:ring-2 focus:ring-black focus:bg-white focus:border-gray-400
                    outline-none transition"
                                />

                                {/* Preparation Duration */}
                                {startDate && endDate && (
                                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5">

                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                                Preparation Period
                                            </span>

                                            <span className="text-sm font-semibold text-gray-900">
                                                {getPreparationDuration()}
                                            </span>
                                        </div>

                                        <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                                            <span>
                                                {format(new Date(startDate), "MMM d, yyyy")}
                                            </span>

                                            <span className="text-gray-400">→</span>

                                            <span>
                                                {format(new Date(endDate), "MMM d, yyyy")}
                                            </span>
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* CTA */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl font-semibold
                bg-black text-white
                transition-all duration-300
                hover:bg-emerald-500 hover:text-black
                hover:shadow-lg hover:shadow-emerald-200
                active:scale-[0.98]
                disabled:opacity-60 disabled:cursor-not-allowed
                cursor-pointer text-sm md:text-base"
                            >
                                {loading ? "Setting things up..." : "Start Preparing"}
                            </button>

                        </form>

                        {/* Footer */}
                        <div className="mt-5 text-center">
                            <a href="/onboarding">
                                <Button
                                    variant="outline"
                                    className="hover:bg-black hover:text-white transition cursor-pointer"
                                >
                                    ← Change exam
                                </Button>
                            </a>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}
