"use client";

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/app/lib/utils";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "@/app/context/userContext";
import { playError, playNotification } from "@/app/lib/sound";

type Test = {
    testId: number;
    title: string | null;
    description: string | null;
    status: 'LOCKED' | 'GENERATE' | 'GIVE' | 'ATTEMPTED';
    createdAt: Date;
};

interface TestsClientProps {
    data: {
        weekly: Test[];
        phase: Test[];
        final: Test[];
        examName?: string;
    };
    baseId: string;
}

export default function TestsClient({ data, baseId }: TestsClientProps) {

    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [newData, setNewData] = useState(data);
    const [progress, setProgress] = useState<number>(0);
    const messageLoopRef = useRef<NodeJS.Timeout | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const { name } = useUser();

    useEffect(() => {
        if (!selectedTest) {
            setElapsedSeconds(0);
            return;
        }

        const interval = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [selectedTest]);

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${remainingSeconds
            .toString()
            .padStart(2, "0")}`;
    };


    const markTestAsGive = (testId: number) => {
        setNewData(prev => ({
            ...prev,
            weekly: prev.weekly.map(test =>
                test.testId === testId
                    ? { ...test, status: "GIVE" }
                    : test
            ),
            phase: prev.phase.map(test =>
                test.testId === testId
                    ? { ...test, status: "GIVE" }
                    : test
            ),
            final: prev.final.map(test =>
                test.testId === testId
                    ? { ...test, status: "GIVE" }
                    : test
            ),
        }));
    };

    if (newData.weekly.length === 0 && newData.phase.length === 0 && newData.final.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-10 mt-20">
                <h2 className="text-xl font-medium text-gray-500">
                    No tests available. Regenerate your roadmap to create tests!
                </h2>
            </div>
        );
    }

    return (
        <>
            {selectedTest !== null && (
                <div className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6 cursor-not-allowed">
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border text-center space-y-5">

                        <div className="text-sm text-justify tracking-tight text-gray-500 flex flex-col gap-y-2">
                            <span>
                                Hey {name?.split(" ")[0] || "there"} ! Your{" "}
                                <span className="font-semibold text-gray-700">
                                    {selectedTest?.title || "test"}
                                </span>{" "}
                                is being carefully built and may take around{" "}
                                <span className="font-bold whitespace-nowrap">4-5</span>{" "}
                                minutes as it's a big responsible task. The app may seem hanged but it's not,
                                don’t worry it’s still working in the background.
                            </span>

                            <span>
                                ☕️ Brew yourself a coffee, scroll for a while and let us handle the planning.
                                We’ll let you know with a notification sound as soon as your test is ready.
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
                                Generating {selectedTest?.title || "test"} for {newData.examName || "the exam"}...
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

            <div className="md:hidden relative h-screen space-y-6 mt-20 py-12 px-4">
                <h1 className="text-2xl font-bold text-center">Tests of {newData.examName}</h1>
                <p className="text-gray-600 font-bold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    Sorry the mobile view is not supported for this page. Please use a desktop or laptop to access the tests.
                </p>
            </div>

            <div className="hidden md:block space-y-10 min-h-screen mt-20 py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold">Tests of {newData.examName}</h1>

                <p className="text-gray-600 tracking-wider leading-relaxed">
                    Here are the tests generated based on your roadmap.<br />
                    Click on <span className="font-bold text-blue-600">"GIVE"</span> to attempt a test or <span className="font-bold text-green-600">"GENERATE"</span> to create a new one.<br />
                    Test which are locked will require you to complete certain tasks or previous tests first.
                </p>
                <TestSection title="Weekly Tests" tests={newData.weekly} baseId={baseId} selectedTest={selectedTest} setSelectedTest={setSelectedTest} markTestAsGive={markTestAsGive} setProgress={setProgress} messageLoopRef={messageLoopRef} loadingMessage={loadingMessage} setLoadingMessage={setLoadingMessage} />
                <TestSection title="Phase Tests" tests={newData.phase} baseId={baseId} selectedTest={selectedTest} setSelectedTest={setSelectedTest} markTestAsGive={markTestAsGive} setProgress={setProgress} messageLoopRef={messageLoopRef} loadingMessage={loadingMessage} setLoadingMessage={setLoadingMessage} />
                <TestSection title="Final Tests" tests={newData.final} baseId={baseId} selectedTest={selectedTest} setSelectedTest={setSelectedTest} markTestAsGive={markTestAsGive} setProgress={setProgress} messageLoopRef={messageLoopRef} loadingMessage={loadingMessage} setLoadingMessage={setLoadingMessage} />
            </div>
        </>
    );
}

function TestSection({
    title,
    tests,
    baseId,
    selectedTest,
    setSelectedTest,
    setProgress,
    loadingMessage,
    setLoadingMessage,
    messageLoopRef,
    markTestAsGive,
}: {
    title: string;
    tests: Test[];
    baseId: string;
    selectedTest: Test | null;
    setSelectedTest: (test: Test | null) => void;
    setProgress: (progress: number) => void;
    loadingMessage: string;
    setLoadingMessage: (message: string) => void;
    messageLoopRef: React.RefObject<NodeJS.Timeout | null>;
    markTestAsGive: (testId: number) => void;
}) {


    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">{title}</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-6">

                {tests.length > 0 ? (
                    tests.map((test) => (
                        <motion.div
                            key={test.testId}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: 0.1 * tests.indexOf(test) }}
                        >
                            <TestCard
                                key={test.testId}
                                test={test}
                                baseId={baseId}
                                selectedTest={selectedTest}
                                setSelectedTest={setSelectedTest}
                                setProgress={setProgress}
                                messageLoopRef={messageLoopRef}
                                loadingMessage={loadingMessage}
                                setLoadingMessage={setLoadingMessage}
                                markTestAsGive={markTestAsGive}
                            />
                        </motion.div>

                    ))
                ) : (
                    <p className="text-gray-500">No tests available.</p>
                )}
            </div>
        </div>
    );
}

function TestCard({
    test,
    baseId,
    selectedTest,
    setSelectedTest,
    setProgress,
    messageLoopRef,
    loadingMessage,
    setLoadingMessage,
    markTestAsGive,
}: {
    test: any;
    baseId: string;
    selectedTest: Test | null;
    setSelectedTest: (test: Test | null) => void;
    setProgress: (progress: number) => void;
    messageLoopRef: React.RefObject<NodeJS.Timeout | null>;
    loadingMessage: string;
    setLoadingMessage: (message: string) => void;
    markTestAsGive: (testId: number) => void;
}) {

    const { soundEnabled } = useUser();

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

    const handleGenerate = (test: Test) => {
        setSelectedTest(test);

        toast.info(
            "Starting test generation. This may take a few moments... Don't refresh the page!"
        );

        const eventSource = new EventSource(
            `/api/test/stream/generate?testId=${encodeURIComponent(test.testId)}`
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                console.log("📡 Test generation event:", data);

                switch (data.type) {
                    case "connected":
                        console.log(data.message);
                        setLoadingMessage(data.message);

                        break;

                    case "progress":

                        // AI generation starts
                        if (data.step === "ai_generation") {

                            setProgress(data.progress);

                            if (!messageLoopRef.current) {
                                const aiMessages = [
                                    "AI is analyzing your roadmap...",
                                    "AI is generating personalized questions...",
                                    "AI is reviewing your progress and topics...",
                                    "AI is crafting the test based on your roadmap...",
                                    "AI is finalizing the test questions...",
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
                        setProgress(data.progress);
                        break;


                    case "completed":
                        console.log(
                            "✅ Test generated:",
                            data.testId
                        );
                        setProgress(100);
                        setLoadingMessage("Test generated successfully! Click on GIVE once the test is ready."
                        );

                        eventSource.close();

                        if (soundEnabled) {
                            playNotification();
                        }

                        toast.success(
                            "Test generated successfully! Click on GIVE once the test is ready."
                        );


                        markTestAsGive(Number(data.testId));
                        setSelectedTest(null);

                        router.refresh();

                        break;

                    case "error":
                        console.error(
                            "❌ Test generation failed:",
                            data.message
                        );

                        eventSource.close();

                        if (soundEnabled) {
                            playError();
                        }

                        toast.error(
                            data.message ||
                            "Test generation failed."
                        );

                        setSelectedTest(null);

                        break;
                }
            } catch (error) {
                console.error(
                    "Error parsing SSE event:",
                    error
                );
            }
        };

        eventSource.onerror = (error) => {
            console.error(
                "❌ SSE connection error:",
                error
            );

            eventSource.close();

            if (soundEnabled) {
                playError();
            }

            toast.error(
                "Connection to test generator was lost."
            );

            setSelectedTest(null);
        };
    };

    const router = useRouter();

    return (
        <Card className="p-4 border shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
            <CardHeader>
                <h3 className="text-lg font-medium">{test.title}</h3>
            </CardHeader>

            <CardContent>
                <p className="text-sm text-gray-600">
                    {test.description || "No description available."}
                </p>
            </CardContent>

            <CardFooter>
                {test.status === "GIVE" ? (
                    <Button
                        onClick={() => {
                            const toastId = `start-test-${test.testId}`;

                            toast.custom(
                                () => (
                                    <div className="bg-white border shadow-xl rounded-2xl p-5 w-87.5">
                                        <h3 className="text-lg font-semibold mb-2">
                                            Start Test?
                                        </h3>

                                        <p className="text-sm text-zinc-600 mb-5 leading-relaxed">
                                            Are you ready to start this test? Once you begin,
                                            the test will enter fullscreen mode and your timer
                                            will start.
                                        </p>

                                        <div className="flex justify-end gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => toast.dismiss(toastId)}
                                            >
                                                Cancel
                                            </Button>

                                            <Button
                                                className="bg-black hover:bg-green-700 text-white cursor-pointer"
                                                onClick={async () => {
                                                    toast.dismiss(toastId);

                                                    try {
                                                        await document.documentElement.requestFullscreen();

                                                        router.push(
                                                            `/user-exam/${baseId}/tests/${test.testId}`
                                                        );
                                                    } catch (error) {
                                                        console.error(
                                                            "Failed to enter fullscreen:",
                                                            error
                                                        );

                                                        toast.error(
                                                            "Unable to enter fullscreen mode. Please try again."
                                                        );
                                                    }
                                                }}
                                            >
                                                Yes, Start
                                            </Button>
                                        </div>
                                    </div>
                                ),
                                {
                                    id: toastId,
                                    duration: Infinity,
                                }
                            );
                        }}
                        disabled={selectedTest !== null}
                        className="bg-blue-700 hover:bg-black text-white cursor-pointer"
                    >
                        GIVE 📝
                    </Button>
                ) : test.status === 'GENERATE' ? (
                    <Button
                        onClick={() => handleGenerate(test)}
                        disabled={selectedTest !== null}
                        className="bg-green-700 hover:bg-blue-700 text-white cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        GENERATE 🎯
                    </Button>

                ) : test.status === 'ATTEMPTED' ? (
                    <Button
                        asChild
                        className="bg-gray-700 hover:bg-black text-white cursor-pointer"
                    >
                        <Link href={`/user-exam/${baseId}/tests/${test.testId}/result`}>
                            VIEW RESULT 📊
                        </Link>
                    </Button>
                ) : (
                    <Button
                        onClick={() => setSelectedTest(test)}
                        className={cn("cursor-not-allowed", test.status === 'GENERATING' ? "bg-yellow-500 text-white" : "bg-red-700 text-white")}
                    >
                        {test.status === 'GENERATING'
                            ? 'GENERATING...'
                            : 'LOCKED 🔒'}
                    </Button>
                )}
            </CardFooter>

        </Card>
    );
}