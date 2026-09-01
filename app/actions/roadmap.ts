"use server";

import { db } from "@/app/lib/db";
import { GoogleGenAI } from "@google/genai";
import { revalidatePath, revalidateTag } from "next/cache";
import { RoadmapSchema } from "@/app/lib/zodSchema";
import { i } from "framer-motion/client";
import { Prisma } from "@/generated/prisma/client";
import { error } from "next/dist/build/output/log";
import { NotificationType } from "@/generated/prisma/enums";

const ai = new GoogleGenAI({});

const MODELS = [
    "gemini-3.7-flash",        // Primary
    "gemini-3.6-flash",        // Strong fallback
    "gemini-3.5-flash",        // Fallback
    "gemini-3.5-flash-lite",   // High-quota emergency fallback
    "gemini-2.5-flash",        // Last resort
] as const;

enum RoadmapFailureReason {
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE",
    RATE_LIMITED = "RATE_LIMITED",
    INVALID_AI_JSON = "INVALID_AI_JSON",
    INVALID_ROADMAP_SCHEMA = "INVALID_ROADMAP_SCHEMA",
    DATABASE_ERROR = "DATABASE_ERROR",
    UNKNOWN = "UNKNOWN",
}

const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export async function generateWithFallback(prompt: string, onProgress: (event: ProgressEvent) => void) {
    let lastError: any;

    const aiStartProgress = 15;
    const aiEndProgress = 35;

    const totalAttempts = MODELS.length * 2;

    let attemptNumber = 0;

    for (const model of MODELS) {
        // Try each model twice
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(
                    `🤖 Trying ${model} (Attempt ${attempt}/2)`
                );

                attemptNumber++;

                const attemptProgress =
                    aiStartProgress +
                    Math.round(
                        ((attemptNumber - 1) /
                            totalAttempts) *
                        (aiEndProgress - aiStartProgress - 2)
                    );

                onProgress({
                    step: "ai_generation_started",
                    message: `Generating roadmap (Attempt ${attempt}/2)...`,
                    progress: attemptProgress,
                });

                onProgress({
                    step: "ai_generation",
                    message: `Generating roadmap with ${model} (Attempt ${attempt}/2)...`,
                    progress: attemptProgress,
                });

                const response =
                    await ai.models.generateContent({
                        model,
                        contents: prompt,
                    });

                console.log(
                    `✅ Success with ${model} (Attempt ${attempt})`
                );

                onProgress({
                    step: "ai_generation_success",
                    message: `Roadmap generated successfully with ${model} (Attempt ${attempt}/2)`,
                    progress: 35,
                });

                return response;
            } catch (err: any) {
                // Keep the latest error so we can throw it
                // after all models have been exhausted.
                err.model = model;
                err.attempt = attempt;

                lastError = err;

                const status =
                    err?.status ??
                    err?.error?.code ??
                    err?.code;

                console.error(
                    `❌ ${model} failed (Attempt ${attempt}/2)`,
                    {
                        status,
                        message: err?.message,
                    }
                );

                // Permanent errors → don't retry
                if ([400, 401, 403].includes(status)) {
                    throw err;
                }

                // Temporary errors → retry once, then move to next model
                if ([429, 500, 503].includes(status)) {
                    if (attempt < 2) {
                        console.log(
                            `⏳ Retrying ${model} in 2 seconds...`
                        );

                        await sleep(2000);
                        continue;
                    }

                    console.log(
                        `➡️ ${model} exhausted. Trying next model...`
                    );

                    break;
                }

                // Any unexpected error should stop immediately
                console.error(
                    `🚨 Unexpected error from ${model}`,
                    err
                );

                throw err;
            }
        }
    }

    throw lastError;
}

export async function generateRoadmap(user_exam_id: number,
    onProgress: (event: ProgressEvent) => void
) {
    try {
        // 1️⃣ Fetch user exam
        const userExam = await db.userExam.findUnique({
            where: { id: user_exam_id },
            include: {
                exam: {
                    include: {
                        subjects: {
                            include: {
                                topics: {
                                    select: {
                                        id: true,
                                        name: true,
                                        difficulty: true,
                                        description: true,
                                    }
                                },
                            },
                        },
                    },
                }
            }
        });

        if (!userExam) {
            throw new Error("UserExam not found");
        }

        if (userExam.roadmap_status === "completed") {
            throw new Error("Roadmap already generated");
        }

        const { exam, start_date, end_date } = userExam;

        let roadmapData: any | null = null;

        if (
            userExam.roadmapJson &&
            Object.keys(userExam.roadmapJson).length > 0
        ) {

            onProgress({
                step: "loading_existing",
                message: "Loading existing roadmap from database...",
                progress: 10,
            });

            const parsed = RoadmapSchema.safeParse(userExam.roadmapJson);

            if (parsed.success) {

                const validTopicIds = new Set(
                    userExam.exam.subjects.flatMap(subject =>
                        subject.topics.map(topic => topic.id)
                    )
                );

                let topicIdsValid = true;

                for (const phase of parsed.data.phases) {
                    for (const week of phase.weeks) {
                        for (const task of week.tasks) {

                            const hasInvalidTopic = task.topics.some(
                                id => !validTopicIds.has(id)
                            );

                            if (hasInvalidTopic) {
                                topicIdsValid = false;
                                break;
                            }
                        }

                        if (!topicIdsValid) break;
                    }

                    if (!topicIdsValid) break;
                }

                // All topic IDs referenced by the generated/existing roadmap
                const generatedTopicIds = new Set<number>();

                for (const phase of parsed.data.phases) {
                    for (const week of phase.weeks) {
                        for (const task of week.tasks) {
                            for (const topicId of task.topics) {
                                generatedTopicIds.add(topicId);
                            }
                        }
                    }
                }


                // Only assign it if BOTH validations passed
                if (topicIdsValid) {
                    roadmapData = parsed.data;
                    onProgress({
                        step: "using_existing",
                        message: "Using existing roadmap from database",
                        progress: 20,
                    });
                    console.log("✅ Using existing roadmapJson from database", userExam.roadmapJson);
                }

            }
        }

        if (!roadmapData) {

            // 2️⃣ Mark generation started
            await db.userExam.update({
                where: { id: user_exam_id },
                data: {
                    roadmap_status: "in_progress",
                },
            });

            // 3️⃣ Build subjects/topics
            const subjects = exam.subjects.map((s: any) => ({
                name: s.name,
                topics: s.topics.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    difficulty: t.difficulty,
                    description: t.description,
                })),
            }));

            // 4️⃣ AI Prompt
            const prompt = `
You are an expert academic planner.

Create a personalized study roadmap for the exam "${exam.name}".

Exam objective:
${exam.aiContext}

Before generating the roadmap, analyze:

- The total preparation duration.
- The difficulty of each subject.
- Dependencies between topics.
- A logical learning order.
- Revision and milestone placement.

Then generate the roadmap.

The roadmap should help a student prepare effectively by breaking down the syllabus into manageable phases, weeks, and tasks.

Preparation duration:
${start_date.toDateString()} to ${end_date.toDateString()}

Subjects and topics:

${subjects.map(subject => `
Subject: ${subject.name}

${subject.topics.map((topic: any) => `
- Topic ID: ${topic.id}
  Name: ${topic.name}
  Difficulty: ${topic.difficulty}
  Description: ${topic.description ?? "N/A"}
`).join("\n")}
`).join("\n")}

Roadmap Rules(VERY IMPORTANT):

    1. Every week should contain 2 - 5 tasks depending on difficulty.
2. Task descriptions must be ONE SHORT SENTENCE(10 - 20 words maximum).
3. Do NOT write paragraphs.
4. Keep titles short(2 - 6 words).
5. Spread difficult topics across multiple weeks instead of merging them.
6. Phases should group related subjects, not individual topics.
7. The roadmap should feel like a university course with incremental progression.
8. Roadmap description will be personalized(3–5 sentences) tailored to the user's profile, goals, current skill level, available time, and target exam. It should explain how this roadmap is specifically designed to help the user achieve their objective.
    9. Topics must appear in a logical prerequisite order.
10. Avoid scheduling unrelated difficult topics in the same week.
11. Reserve the final weeks for revision, mock tests, and weak - topic improvement.
12. Do not repeat the same topic in multiple tasks unless it is a revision task.

Date Constraints -

        -All dates must lie between the preparation start and end dates.
- Task dates must never overlap outside their week.
- Weeks must be consecutive.
- Phases must be consecutive.
- Roadmap start_date must equal the earliest task start_date.
- Roadmap end_date must equal the latest task end_date.
- Every phase date range must fully contain its weeks.
- Every week date range must fully contain its tasks.
- Milestone dates must fall within the roadmap duration.

TOPIC ID RULES — STRICTLY FOLLOW:

Every task MUST include a "topics" field containing an array of integer topic IDs.

The ONLY valid topic IDs are the exact IDs explicitly provided in the "Subjects and topics" section above.

You MUST NOT:
- invent topic IDs
- guess topic IDs
- generate new topic IDs
- modify or transform topic IDs
- use sequential IDs unless they are explicitly provided
- use topic IDs from your general knowledge
- use topic IDs that are not present in the provided syllabus
- use topic names instead of IDs
- create IDs based on topic position, subject position, or array index

For every task, select topic IDs ONLY from the Topic ID values provided above.

Before returning the final JSON, internally verify EVERY integer inside every task's "topics" array against the provided Topic IDs.

If a task cannot be associated with at least one of the provided Topic IDs, DO NOT create that task.

NEVER return a topic ID that does not appear exactly in the provided Topic ID list.

Example:

If the provided topics contain:
- Topic ID: 12
- Topic ID: 18
- Topic ID: 27

Then these are valid:
"topics": [12]
"topics": [18, 27]

These are INVALID:
"topics": [1]
"topics": [13]
"topics": [99]

The topic IDs are database identifiers, NOT numbers that you should infer or generate.

Return ONLY the exact database topic IDs provided in the input.

Return ONLY a single valid JSON object.

The response must:

    -contain no markdown
        - contain no code fences
            - contain no explanations
                - contain no comments
                    - contain no trailing commas
                        - contain no additional keys
                            - exactly match the schema below:

    {
        "title": "string",
            "description": "string",
                "start_date": "YYYY-MM-DD",
                    "end_date": "YYYY-MM-DD",

                        "phases": [
                            {
                                "phase_name": "string",
                                "description": "string",
                                "duration": "string",
                                "start_date": "YYYY-MM-DD",
                                "end_date": "YYYY-MM-DD",

                                "weeks": [
                                    {
                                        "week_number": 1,
                                        "focus": "string",
                                        "start_date": "YYYY-MM-DD",
                                        "end_date": "YYYY-MM-DD",

                                        "tasks": [
                                            {
                                                "title": "string",
                                                "description": "string",
                                                "start_date": "YYYY-MM-DD",
                                                "end_date": "YYYY-MM-DD",
                                                "topics": [1, 2, 3]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ],

                            "milestones": [
                                {
                                    "name": "string",
                                    "goal": "string",
                                    "target_date": "YYYY-MM-DD"
                                }
                            ]
    }

Do NOT

        - invent extra fields
            - rename fields
                - omit required fields
                    - return null values
                        - leave empty arrays unless unavoidable
                            - use placeholder text such as "Task 1" or "Description"

                                `;


            console.log("🟡 Sending prompt to AI:", new Date().toISOString());
            const promptStart = Date.now();

            onProgress({
                step: "ai_generation_starts",
                message: "Preparing your exam data for AI roadmap generation...",
                progress: 10,
            });

            // 5️⃣ Generate roadmap with AI
            const response = await generateWithFallback(prompt, onProgress);

            console.log(
                "🟢 AI response received in:",
                ((Date.now() - promptStart) / 1000).toFixed(2),
                "seconds"
            );

            let textResponse = response.text ?? "";

            // Clean AI response
            const cleanedText = textResponse
                .trim()
                .replace(/^```json\s */i, "")
                .replace(/^```\s*/i, "")
                .replace(/```$/g, "")
                .trim();

            const resData = JSON.parse(cleanedText);
            const parsed = RoadmapSchema.safeParse(resData);

            if (!parsed.success) {
                console.error(parsed.error.message);
                throw new Error("Roadmap validation failed: " + parsed.error.message);
            }

            // Validate topic IDs
            const validTopicIds = new Set(
                exam.subjects.flatMap(subject =>
                    subject.topics.map(topic => topic.id)
                )
            );

            for (const phase of parsed.data.phases) {
                for (const week of phase.weeks) {
                    for (const task of week.tasks) {

                        const invalidTopicIds = task.topics.filter(
                            id => !validTopicIds.has(id)
                        );

                        if (invalidTopicIds.length > 0) {
                            throw new Error(
                                `Task "${task.title}" contains invalid topic IDs: ${invalidTopicIds.join(", ")}`
                            );
                        }
                    }
                }
            }

            roadmapData = parsed.data;

            await db.userExam.update({
                where: { id: user_exam_id },
                data: {
                    roadmapJson: roadmapData,
                },
            });
        }

        let roadmap;

        console.log("🟡 Starting roadmap transaction:", new Date().toISOString());

        onProgress({
            step: "generated",
            message: "AI Roadmap Generated now processing it to the database!",
            progress: 50,
        });

        const transactionStart = Date.now();
        const transactionStartProgress = 60;
        const transactionEndProgress = 90;
        const totalPhases = roadmapData.phases.length;

        const totalWeeks = roadmapData.phases.reduce(
            (total: number, phase: any): number =>
                total +
                (Array.isArray(phase.weeks)
                    ? phase.weeks.length
                    : 0),
            0
        );

        let completedWeeks = 0;

        // 6️⃣ Save everything in TRANSACTION
        roadmap = await db.$transaction(async (tx) => {

            //Delete existing tests for this user_exam_id
            await tx.test.deleteMany({
                where: { userExamId: user_exam_id },
            });

            // Delete existing roadmap, phases, weeks, tasks, milestones
            await tx.roadmap.deleteMany({
                where: { user_exam_id },
            });

            const createdRoadmap = await tx.roadmap.create({
                data: {
                    user_exam_id,
                    title:
                        roadmapData.title ||
                        `Roadmap for ${exam.name}`,
                    description:
                        roadmapData.description ||
                        "Generated by AI",
                    generated_by_ai: true,
                    start_date,
                    end_date,
                },
            });

            console.log("Creating phases, weeks, and tests at:", new Date().toISOString());
            const phsasesStart = Date.now();

            onProgress({
                step: "phases",
                message: "Creating phases, weeks, and tests...",
                progress: 60,
            });


            // Create phases → weeks → tasks
            if (
                roadmapData.phases &&
                Array.isArray(roadmapData.phases)
            ) {
                for (const [
                    phaseIndex,
                    phase,
                ] of roadmapData.phases.entries()) {

                    const createdPhase =
                        await tx.roadmapPhase.create({
                            data: {
                                roadmap_id:
                                    createdRoadmap.id,
                                phase_name:
                                    phase.phase_name,
                                description:
                                    phase.description ||
                                    null,
                                duration:
                                    phase.duration ||
                                    null,
                                order_index:
                                    phaseIndex,
                                start_date:
                                    phase.start_date
                                        ? new Date(
                                            phase.start_date
                                        )
                                        : null,
                                end_date:
                                    phase.end_date
                                        ? new Date(
                                            phase.end_date
                                        )
                                        : null,
                            },
                        });

                    // 🔥 PHASE TEST
                    await tx.test.create({
                        data: {
                            title: `${phase.phase_name} Test`,
                            type: "PHASE",

                            description: `Assessment for ${phase.phase_name}`,

                            userExamId: user_exam_id,

                            phaseId: createdPhase.id,

                            totalMarks: 20,

                            duration: 30,

                            isGenerated: false,
                        },
                    });

                    if (
                        phase.weeks &&
                        Array.isArray(phase.weeks)
                    ) {
                        for (const [
                            weekIndex,
                            week,
                        ] of phase.weeks.entries()) {

                            const createdWeek =
                                await tx.roadmapWeek.create({
                                    data: {
                                        phase_id:
                                            createdPhase.id,
                                        week_number:
                                            week.week_number ||
                                            weekIndex + 1,
                                        focus:
                                            week.focus,
                                        order_index:
                                            weekIndex,
                                        start_date:
                                            week.start_date
                                                ? new Date(
                                                    week.start_date
                                                )
                                                : null,
                                        end_date:
                                            week.end_date
                                                ? new Date(
                                                    week.end_date
                                                )
                                                : null,
                                    },
                                });

                            // 🔥 WEEKLY TEST
                            await tx.test.create({
                                data: {
                                    title: `Week ${createdWeek.week_number} Test`,
                                    type: "WEEKLY",

                                    description: `Assessment for Week ${createdWeek.week_number} : ${createdWeek.focus}`,

                                    userExamId: user_exam_id,

                                    weekId: createdWeek.id,

                                    totalMarks: 10,

                                    duration: 15,

                                    isGenerated: false,
                                },
                            });

                            // Tasks
                            if (
                                week.tasks &&
                                Array.isArray(
                                    week.tasks
                                )
                            ) {
                                for (const [taskIndex, task] of week.tasks.entries()) {
                                    await tx.roadmapTask.create({
                                        data: {
                                            week_id: createdWeek.id,
                                            title: task.title,
                                            description: task.description || null,
                                            start_date: task.start_date
                                                ? new Date(task.start_date)
                                                : null,
                                            end_date: task.end_date
                                                ? new Date(task.end_date)
                                                : null,
                                            order_index: taskIndex,

                                            topics: {
                                                connect: task.topics.map((id: number) => ({
                                                    id,
                                                })),
                                            },
                                        },
                                    });
                                }
                            }

                            completedWeeks++;
                            const weekProgress =
                                transactionStartProgress +
                                Math.round(
                                    (completedWeeks / totalWeeks) *
                                    (transactionEndProgress - transactionStartProgress)
                                );
                            console.log(`Week ${completedWeeks} of ${totalWeeks} created. Progress: ${weekProgress}`);

                            onProgress({
                                step: "week_completed",
                                message: `Created tasks for Week ${createdWeek.week_number} of Phase ${phaseIndex + 1}.`,
                                progress: weekProgress,
                            });
                        }

                    }

                    const phaseProgress =
                        transactionStartProgress +
                        Math.round(
                            ((phaseIndex + 1) / totalPhases) *
                            (transactionEndProgress - transactionStartProgress)
                        );

                    onProgress({
                        step: "phase_completed",
                        message: `Created weeks and tasks for Phase ${phaseIndex + 1}.`,
                        progress: phaseProgress,
                    });

                }
            }

            console.log(
                "🟢 Phases, weeks, and tasks created in:",
                ((Date.now() - phsasesStart) / 1000).toFixed(2),
                "seconds"
            );

            console.log("Creating milestones at:", new Date().toISOString());
            const milestonesStart = Date.now();

            // Milestones
            if (
                roadmapData.milestones &&
                Array.isArray(
                    roadmapData.milestones
                )
            ) {
                await tx.milestone.createMany({
                    data:
                        roadmapData.milestones.map(
                            (m: any) => ({
                                roadmap_id:
                                    createdRoadmap.id,
                                name: m.name,
                                goal: m.goal || null,
                                target_date:
                                    m.target_date
                                        ? new Date(
                                            m.target_date
                                        )
                                        : null,
                            })
                        ),
                });
            }

            console.log(
                "🟢 Milestones created in:",
                ((Date.now() - milestonesStart) / 1000).toFixed(2),
                "seconds"
            );

            console.log("Creating final tests at:", new Date().toISOString());
            const finalTestsStart = Date.now();

            onProgress({
                step: "final_tests",
                message: "Creating final tests...",
                progress: 90,
            });

            // 🔥 FINAL TESTS
            await tx.test.createMany({
                data: [
                    {
                        title: "Final Revision Test 1",
                        type: "FINAL",

                        description:
                            "Covers earlier roadmap phases and weeks",

                        userExamId: user_exam_id,

                        totalMarks: 50,

                        duration: 70,

                        nOfFinalTests: 1,

                        isGenerated: false,
                    },

                    {
                        title: "Final Revision Test 2",
                        type: "FINAL",

                        description:
                            "Intermediate full syllabus assessment",

                        userExamId: user_exam_id,

                        totalMarks: 50,

                        duration: 70,

                        nOfFinalTests: 2,

                        isGenerated: false,
                    },

                    {
                        title: "Final Grand Mock Test",
                        type: "FINAL",

                        description:
                            "Complete exam simulation",

                        userExamId: user_exam_id,

                        totalMarks: 50,

                        duration: 70,

                        nOfFinalTests: 3,

                        isGenerated: false,
                    },
                ],
            });

            console.log(
                "🟢 Final tests created in:",
                ((Date.now() - finalTestsStart) / 1000).toFixed(2),
                "seconds"
            );

            return createdRoadmap;
        }, {
            maxWait: 10000,
            timeout: 180000,
        });

        console.log(
            "🟢 Roadmap transaction completed in:",
            ((Date.now() - transactionStart) / 1000).toFixed(2),
            "seconds"
        );

        if (!roadmap) {
            throw new Error("Failed to create roadmap after multiple attempts");
        }

        // 7️⃣ Mark completed
        await db.userExam.update({
            where: { id: user_exam_id },
            data: {
                roadmap_status: "completed",
                failure_reason: null,
                roadmapJson: Prisma.JsonNull
            },
        });

        // 8️⃣ Notification
        await db.notification.create({
            data: {
                user_id: userExam.user_id,
                message: `Your roadmap for ${exam.name} has been generated successfully!`,
                user_exam_id: user_exam_id,
                roadmap_id: roadmap.id,
                type:NotificationType.ROADMAP,
            },
        });

        revalidateTag(`roadmap-${user_exam_id}-user-${userExam.user_id}`, { expire: 0 });
        revalidateTag(`exam-${exam.id}`, { expire: 0 });
        revalidateTag(`exams`, { expire: 0 });
        revalidateTag(`userDashboard-${userExam.user_id}`, { expire: 0 });
        revalidateTag(`userExams-${userExam.user_id}`, { expire: 0 });
        revalidateTag(`tests-${user_exam_id}-user-${userExam.user_id}`, { expire: 0 });
        revalidateTag(`todaysTasks-${userExam.user_id}`, { expire: 0 });
        revalidateTag(`userExam-${user_exam_id}`, { expire: 0 });
        revalidateTag(`profileData-${userExam.user_id}`, { expire: 0 });
        revalidatePath(`/dashboard`); // Revalidate the dashboard path for the user


        onProgress({
            step: "completed",
            message: "Roadmap generated successfully!",
            progress: 95,
        });

        return {
            success: true,
            roadmap_id: roadmap.id,
        };

    } catch (err: any) {
        let failureReason = RoadmapFailureReason.UNKNOWN;

        const status =
            err?.status ??
            err?.error?.code ??
            err?.code;

        if (err.message === "INVALID_AI_JSON") {
            failureReason = RoadmapFailureReason.INVALID_AI_JSON;
        } else if (err.message === "INVALID_ROADMAP_SCHEMA") {
            failureReason = RoadmapFailureReason.INVALID_ROADMAP_SCHEMA;
        } else if (status === 429) {
            failureReason = RoadmapFailureReason.RATE_LIMITED;
        } else if ([500, 503].includes(status)) {
            failureReason = RoadmapFailureReason.MODEL_UNAVAILABLE;
        } else if (
            err.name === "PrismaClientKnownRequestError" ||
            err.name === "PrismaClientUnknownRequestError"
        ) {
            failureReason = RoadmapFailureReason.DATABASE_ERROR;
        }

        await db.userExam.update({
            where: { id: user_exam_id },
            data: {
                roadmap_status: "failed",
                failure_reason: failureReason,
            },
        });

        console.error("❌ Roadmap generation failed", {
            reason: failureReason,
            status,
            message: err?.message,
            model: err?.model,
        });

        return {
            success: false,
            error: err.message,
            failureReason,
        };
    }
}

type ProgressEvent = {
    step: string;
    message: string;
    progress: number;
};

