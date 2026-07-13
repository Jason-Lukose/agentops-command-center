import "dotenv/config";
import { Prisma, type EvaluatorType } from "@prisma/client";
import { prisma } from "../src/lib/db";

// -----------------------------------------------------------------------------
// Seed data for AgentOps Command Center.
//
// Creates two workflows:
//   1. "Support Ticket Triage Pipeline" — 6 steps, exercises all 5 StepTypes
//      (llm_prompt, transform, tool_api, llm_prompt, approval, eval).
//   2. "Content Summarizer QA" — 4 steps (llm_prompt, eval, llm_prompt, eval),
//      covering the deterministic + llm_judge evaluator types.
//
// Then backfills ~16 historical Runs across both workflows, spread over the
// past 14 days, with full StepExecution traces and EvaluationResult rows so
// the dashboard, run-trace view, and eval-score history are never empty.
//
// Re-runnable: wipes existing rows for these tables before inserting fresh
// data (dev-only database — see docs/DATA_MODEL.md "Migration Story").
// -----------------------------------------------------------------------------

function daysAgo(days: number, hourJitter = 0): Date {
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000 - hourJitter * 60 * 60 * 1000;
  // Clamp: with days=0 the jitter could otherwise land in the future, which
  // renders as "in about 1 hour" in the UI's relative timestamps.
  return new Date(Math.min(now - ms, now));
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Mock GPT-4o-mini-ish pricing: $0.15/1M input tokens, $0.60/1M output tokens. */
function costEstimate(tokensIn: number, tokensOut: number): number {
  const cost = tokensIn * 0.00000015 + tokensOut * 0.0000006;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

// -----------------------------------------------------------------------------
// Content pools
// -----------------------------------------------------------------------------

const TICKETS = [
  {
    subject: "Billing discrepancy on March invoice",
    body: "My invoice for March shows a charge of $49.99 but I was told my plan was $29.99/month when I signed up. Can you explain this discrepancy?",
    customerName: "Priya Nair",
    plan: "Growth",
    category: "billing",
    urgency: "high",
  },
  {
    subject: "CSV export crashes the app",
    body: "The app crashes every time I try to export a report to CSV. This is blocking my end-of-month workflow and I need it fixed today.",
    customerName: "Marcus Webb",
    plan: "Pro",
    category: "bug",
    urgency: "high",
  },
  {
    subject: "Please cancel my subscription",
    body: "I'd like to cancel my subscription immediately and get a refund for this month. The product doesn't fit our team's needs.",
    customerName: "Elena Fischer",
    plan: "Starter",
    category: "cancellation",
    urgency: "medium",
  },
  {
    subject: "Can't log in — invalid session error",
    body: "Login keeps failing with 'invalid session' even after I reset my password twice. I've tried three browsers and it's still broken.",
    customerName: "Daniel Osei",
    plan: "Pro",
    category: "account",
    urgency: "high",
  },
  {
    subject: "Feature request: dark mode",
    body: "Would love to see a dark mode added to the mobile app — a lot of our team works late and the bright UI is rough on the eyes.",
    customerName: "Sofia Ramirez",
    plan: "Growth",
    category: "feature_request",
    urgency: "low",
  },
  {
    subject: "Double charged this month",
    body: "We were double-charged this month — two separate $99 charges on the same day, June 3rd. Please refund the duplicate.",
    customerName: "Tomasz Kowalski",
    plan: "Pro",
    category: "billing",
    urgency: "high",
  },
];

const DRAFT_REPLIES: Record<string, string> = {
  billing:
    "Hi {{name}}, thanks for flagging this — I've pulled up your account and confirmed the charge doesn't match your {{plan}} plan rate. I'm issuing a correction and you'll see the adjustment reflected within 2-3 business days. Sorry for the confusion here.",
  bug: "Hi {{name}}, sorry for the disruption — I can reproduce the CSV export crash on our end and it's been flagged to engineering as high priority. In the meantime, exporting to XLSX works as a workaround. I'll follow up as soon as the fix ships.",
  cancellation:
    "Hi {{name}}, I've processed your cancellation and a refund for this billing cycle — you should see it within 5-7 business days. If there's anything specific that didn't work for your team, I'd love to hear it so we can improve.",
  account:
    "Hi {{name}}, I'm sorry for the login trouble. I've cleared your active sessions server-side, which typically resolves the 'invalid session' error. Please try logging in again in a private/incognito window and let me know if it persists.",
  feature_request:
    "Hi {{name}}, thanks for the suggestion! Dark mode is on our roadmap and this request helps us prioritize it. I've logged your vote against the existing feature request so you'll be notified when it ships.",
};

const ARTICLES = [
  {
    title: "Why Async Standups Beat Daily Meetings for Distributed Teams",
    body: "Distributed teams lose hours each week to synchronous standups that force people across time zones into awkward early mornings or late nights. Async standups — a shared written update posted once a day — let engineers report status on their own schedule while still surfacing blockers. Teams that switched report fewer interruptions and faster resolution of cross-timezone blockers, though the format requires more disciplined writing than a two-minute verbal update.",
    summary:
      "Async written standups reduce interruptions and timezone friction for distributed teams compared to synchronous meetings, at the cost of requiring more disciplined written updates.",
    generatedTitle: "Async Standups: A Better Fit for Distributed Teams",
  },
  {
    title: "The Hidden Cost of Premature Microservices",
    body: "Teams that split a monolith into microservices before product-market fit often pay a steep tax: every feature now requires coordinating deploys across services, debugging spans multiple logs, and a two-person team ends up running the operational overhead of a much larger org. The pattern that works best for early-stage products is a single deployable unit kept clean internally, splitting services only once there's a measured, specific reason — a scaling bottleneck or an independent team boundary — to do so.",
    summary:
      "Splitting into microservices before product-market fit adds coordination and operational overhead that early-stage teams can't afford; a single well-structured deployable unit scales better until a specific, measured reason to split appears.",
    generatedTitle: "Don't Split Into Microservices Before You Need To",
  },
  {
    title: "What Actually Moves the Needle in Onboarding Flows",
    body: "Analysis across dozens of B2B SaaS onboarding flows shows that reducing the number of screens has less impact on activation than getting a user to their first meaningful success moment quickly — even if that takes an extra step. Products that front-load a guided 'aha moment' before asking for configuration details see meaningfully higher week-one retention than products optimized purely for fewer clicks to sign-up.",
    summary:
      "Onboarding flows that get users to a first meaningful success moment quickly drive better week-one retention than flows merely optimized to minimize the number of screens or clicks.",
    generatedTitle: "Time-to-Value Beats Click Reduction in Onboarding",
  },
  {
    title: "A Field Guide to Debugging Flaky Integration Tests",
    body: "Flaky integration tests usually trace back to one of four causes: shared mutable state between test runs, timing assumptions about async operations, unseeded randomness, or reliance on real network calls to external services. Fixing flakiness durably means isolating test data per run, replacing arbitrary sleeps with explicit wait conditions, seeding all randomness, and mocking network boundaries — patching the symptom by re-running a flaky suite just delays the real fix.",
    summary:
      "Flaky integration tests are typically caused by shared state, timing assumptions, unseeded randomness, or real network calls; durable fixes isolate test data, use explicit waits, seed randomness, and mock network boundaries.",
    generatedTitle: "Why Your Integration Tests Are Flaky (And How to Fix It)",
  },
];

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log("Seeding database...");

  // Wipe in FK-safe order (children first). Dev-only DB — see DATA_MODEL.md.
  await prisma.evaluationResult.deleteMany();
  await prisma.stepExecution.deleteMany();
  await prisma.run.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();

  // ---------------------------------------------------------------------
  // Workflow 1: Support Ticket Triage Pipeline (all 5 step types)
  // ---------------------------------------------------------------------
  const triageWorkflow = await prisma.workflow.create({
    data: {
      name: "Support Ticket Triage Pipeline",
      description:
        "Classifies an inbound support ticket, looks up the customer, drafts a reply, routes it through human approval, and scores the reply for quality.",
      steps: {
        create: [
          {
            position: 0,
            type: "llm_prompt",
            name: "Classify Ticket",
            config: {
              promptTemplate:
                "Classify the following support ticket. Respond with ONLY a raw JSON object (no markdown, no code fences) of the shape {\"category\":\"billing|bug|cancellation|account|feature_request\",\"urgency\":\"low|medium|high\",\"confidence\":0.0-1.0}. Ticket:\n{{ticket.body}}",
              temperature: 0.2,
            },
          },
          {
            position: 1,
            type: "transform",
            name: "Parse Classification JSON",
            config: {
              expression: "JSON.parse(steps[0].output.raw)",
              description: "Extracts { category, urgency, confidence } from the raw model completion.",
            },
          },
          {
            position: 2,
            type: "tool_api",
            name: "Lookup Customer",
            config: {
              method: "GET",
              url: "https://mock-crm.internal/api/customers/{{ticket.customerId}}",
              timeoutMs: 8000,
            },
          },
          {
            position: 3,
            type: "llm_prompt",
            name: "Draft Response",
            config: {
              promptTemplate:
                "Draft a helpful, empathetic support reply (plain text, no markdown, 3-5 sentences) that resolves or clearly progresses the issue.\n\nTicket subject: {{ticket.subject}}\nTicket body: {{ticket.body}}\nClassification: {{steps[1].output.category}} (urgency: {{steps[1].output.urgency}})\nCustomer: {{steps[2].output.name}}, plan: {{steps[2].output.plan}}, tenure: {{steps[2].output.tenureMonths}} months, prior tickets: {{steps[2].output.priorTicketCount}}",
              temperature: 0.4,
            },
          },
          {
            position: 4,
            type: "approval",
            name: "Human Review",
            config: {
              prompt: "Review the drafted reply for tone and accuracy before it is sent to the customer.",
              requiredRole: "support_lead",
            },
          },
          {
            position: 5,
            type: "eval",
            name: "Quality Check",
            config: {
              evaluatorType: "rubric",
              criteria: ["tone", "accuracy", "completeness"],
            },
          },
        ],
      },
    },
    include: { steps: { orderBy: { position: "asc" } } },
  });

  // ---------------------------------------------------------------------
  // Workflow 2: Content Summarizer QA
  // ---------------------------------------------------------------------
  const summarizerWorkflow = await prisma.workflow.create({
    data: {
      name: "Content Summarizer QA",
      description:
        "Summarizes an article, checks the summary against a deterministic length/format rule, generates a title, and judges the title's relevance.",
      steps: {
        create: [
          {
            position: 0,
            type: "llm_prompt",
            name: "Summarize Content",
            config: {
              promptTemplate: "Summarize the following article in 2-4 sentences:\n{{article.body}}",
              temperature: 0.3,
            },
          },
          {
            position: 1,
            type: "eval",
            name: "Length & Format Check",
            config: {
              evaluatorType: "deterministic",
              checks: [
                { type: "max_length", max: 500 },
                { type: "min_length", min: 10 },
              ],
            },
          },
          {
            position: 2,
            type: "llm_prompt",
            name: "Generate Title",
            config: {
              promptTemplate: "Generate a concise, engaging title for this summary:\n{{steps[0].output.raw}}",
              temperature: 0.5,
            },
          },
          {
            position: 3,
            type: "eval",
            name: "Judge Title Relevance",
            config: {
              evaluatorType: "llm_judge",
              rubric: "Does the title accurately and engagingly represent the summary?",
            },
          },
        ],
      },
    },
    include: { steps: { orderBy: { position: "asc" } } },
  });

  console.log(
    `Created workflows: "${triageWorkflow.name}" (${triageWorkflow.steps.length} steps), "${summarizerWorkflow.name}" (${summarizerWorkflow.steps.length} steps)`
  );

  // ---------------------------------------------------------------------
  // Historical runs — Support Ticket Triage Pipeline
  // ---------------------------------------------------------------------
  const [classifyStep, parseStep, lookupStep, draftStep, approvalStep, evalStep] = triageWorkflow.steps;

  type TriageSpec = {
    ticketIdx: number;
    status: "succeeded" | "failed" | "canceled" | "awaiting_approval";
    daysAgoStart: number;
    failAt?: "lookup" | "classify";
    retryStep?: "classify" | "lookup" | "draft";
    retryCount?: number;
  };

  const triageSpecs: TriageSpec[] = [
    { ticketIdx: 0, status: "succeeded", daysAgoStart: 13 },
    { ticketIdx: 1, status: "succeeded", daysAgoStart: 12 },
    { ticketIdx: 2, status: "failed", daysAgoStart: 11, failAt: "lookup" },
    { ticketIdx: 3, status: "succeeded", daysAgoStart: 10 },
    { ticketIdx: 4, status: "succeeded", daysAgoStart: 9 },
    { ticketIdx: 5, status: "canceled", daysAgoStart: 8 },
    { ticketIdx: 0, status: "succeeded", daysAgoStart: 6, retryStep: "classify", retryCount: 1 },
    { ticketIdx: 1, status: "awaiting_approval", daysAgoStart: 3 },
    { ticketIdx: 2, status: "succeeded", daysAgoStart: 2 },
    { ticketIdx: 3, status: "succeeded", daysAgoStart: 1, retryStep: "draft", retryCount: 2 },
  ];

  for (const spec of triageSpecs) {
    const ticket = TICKETS[spec.ticketIdx];
    const createdAt = daysAgo(spec.daysAgoStart, randInt(0, 6));
    let cursor = addMs(createdAt, randInt(200, 2000)); // startedAt

    const startedAt = cursor;
    const classification = {
      category: ticket.category,
      urgency: ticket.urgency,
      confidence: Math.round((0.8 + Math.random() * 0.19) * 100) / 100,
    };
    const customerRecord = {
      customerId: `cust_${1000 + spec.ticketIdx}`,
      name: ticket.customerName,
      email: `${ticket.customerName.split(" ")[0].toLowerCase()}@example.com`,
      plan: ticket.plan,
      tenureMonths: randInt(1, 36),
      priorTicketCount: randInt(0, 5),
    };
    const draftReply = DRAFT_REPLIES[ticket.category]
      .replace("{{name}}", ticket.customerName.split(" ")[0])
      .replace("{{plan}}", ticket.plan);

    const stepExecData: Prisma.StepExecutionUncheckedCreateWithoutRunInput[] = [];

    // Step 0: Classify Ticket (llm_prompt)
    const classifyRetries = spec.retryStep === "classify" ? spec.retryCount ?? 1 : 0;
    const classifyTokensIn = randInt(80, 220);
    const classifyTokensOut = randInt(40, 120);
    const classifyLatency = randInt(300, 2200);
    stepExecData.push({
      stepId: classifyStep.id,
      position: 0,
      status: "succeeded",
      input: { ticket: { subject: ticket.subject, body: ticket.body, customerId: customerRecord.customerId } },
      output: { raw: JSON.stringify(classification), ...classification },
      retryCount: classifyRetries,
      latencyMs: classifyLatency,
      tokensIn: classifyTokensIn,
      tokensOut: classifyTokensOut,
      costEstimate: costEstimate(classifyTokensIn, classifyTokensOut),
      createdAt: cursor,
    });
    cursor = addMs(cursor, classifyLatency + classifyRetries * 400);

    // Step 1: Parse Classification JSON (transform)
    const parseLatency = randInt(5, 40);
    stepExecData.push({
      stepId: parseStep.id,
      position: 1,
      status: "succeeded",
      input: { raw: JSON.stringify(classification) },
      output: classification,
      retryCount: 0,
      latencyMs: parseLatency,
      createdAt: cursor,
    });
    cursor = addMs(cursor, parseLatency);

    // Step 2: Lookup Customer (tool_api) — may fail
    const lookupFails = spec.status === "failed" && spec.failAt === "lookup";
    const lookupRetries = spec.retryStep === "lookup" ? spec.retryCount ?? 1 : 0;
    const lookupLatency = randInt(150, 1800);
    if (lookupFails) {
      const errMsg = "CRM lookup failed: upstream timeout after 8000ms (mock-crm.internal)";
      stepExecData.push({
        stepId: lookupStep.id,
        position: 2,
        status: "failed",
        input: { customerId: customerRecord.customerId },
        output: Prisma.DbNull,
        errorMessage: errMsg,
        retryCount: 2,
        latencyMs: 8000,
        createdAt: cursor,
      });
      cursor = addMs(cursor, 8000);

      // Remaining steps skipped
      stepExecData.push(
        { stepId: draftStep.id, position: 3, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: approvalStep.id, position: 4, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: evalStep.id, position: 5, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor }
      );

      const run = await prisma.run.create({
        data: {
          workflowId: triageWorkflow.id,
          status: "failed",
          input: { ticket: { subject: ticket.subject, body: ticket.body } },
          output: Prisma.JsonNull,
          errorMessage: errMsg,
          startedAt,
          finishedAt: cursor,
          latencyMs: cursor.getTime() - startedAt.getTime(),
          createdAt,
          steps: { create: stepExecData },
        },
      });
      console.log(`  Run ${run.id} (triage, failed at Lookup Customer)`);
      continue;
    }

    stepExecData.push({
      stepId: lookupStep.id,
      position: 2,
      status: "succeeded",
      input: { customerId: customerRecord.customerId },
      output: customerRecord,
      retryCount: lookupRetries,
      latencyMs: lookupLatency,
      createdAt: cursor,
    });
    cursor = addMs(cursor, lookupLatency + lookupRetries * 500);

    if (spec.status === "canceled") {
      // Canceled mid-run: steps 0-2 done, remaining skipped, no draft/approval/eval.
      stepExecData.push(
        { stepId: draftStep.id, position: 3, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: approvalStep.id, position: 4, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: evalStep.id, position: 5, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor }
      );
      const run = await prisma.run.create({
        data: {
          workflowId: triageWorkflow.id,
          status: "canceled",
          input: { ticket: { subject: ticket.subject, body: ticket.body } },
          output: Prisma.JsonNull,
          errorMessage: null,
          startedAt,
          finishedAt: cursor,
          latencyMs: cursor.getTime() - startedAt.getTime(),
          createdAt,
          steps: { create: stepExecData },
        },
      });
      console.log(`  Run ${run.id} (triage, canceled after Lookup Customer)`);
      continue;
    }

    // Step 3: Draft Response (llm_prompt)
    const draftRetries = spec.retryStep === "draft" ? spec.retryCount ?? 1 : 0;
    const draftTokensIn = randInt(200, 500);
    const draftTokensOut = randInt(120, 400);
    const draftLatency = randInt(600, 4000);
    stepExecData.push({
      stepId: draftStep.id,
      position: 3,
      status: "succeeded",
      input: { ticket: { subject: ticket.subject, body: ticket.body }, classification, customer: customerRecord },
      output: { reply: draftReply },
      retryCount: draftRetries,
      latencyMs: draftLatency,
      tokensIn: draftTokensIn,
      tokensOut: draftTokensOut,
      costEstimate: costEstimate(draftTokensIn, draftTokensOut),
      createdAt: cursor,
    });
    cursor = addMs(cursor, draftLatency + draftRetries * 600);

    if (spec.status === "awaiting_approval") {
      stepExecData.push(
        {
          stepId: approvalStep.id,
          position: 4,
          status: "awaiting_approval",
          input: { draftReply, ticketSubject: ticket.subject },
          output: Prisma.JsonNull,
          retryCount: 0,
          createdAt: cursor,
        },
        { stepId: evalStep.id, position: 5, status: "pending", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor }
      );
      const run = await prisma.run.create({
        data: {
          workflowId: triageWorkflow.id,
          status: "awaiting_approval",
          input: { ticket: { subject: ticket.subject, body: ticket.body } },
          output: Prisma.JsonNull,
          startedAt,
          finishedAt: null,
          latencyMs: null,
          createdAt,
          steps: { create: stepExecData },
        },
      });
      console.log(`  Run ${run.id} (triage, awaiting_approval)`);
      continue;
    }

    // Step 4: Human Review (approval) — approved minutes-to-hours later.
    // latencyMs is the handling time only; the human wait is dwell time, not
    // execution latency (mirrors runner.ts executionLatencyMs semantics).
    const approvalDecidedAt = addMs(cursor, randInt(60_000, 4 * 60 * 60_000));
    const approvalHandlingMs = randInt(400, 2500);
    stepExecData.push({
      stepId: approvalStep.id,
      position: 4,
      status: "succeeded",
      input: { draftReply, ticketSubject: ticket.subject },
      output: { decision: "approved", note: "Looks good, ship it." },
      retryCount: 0,
      latencyMs: approvalHandlingMs,
      approvalDecidedAt,
      createdAt: cursor,
    });
    cursor = approvalDecidedAt;

    // Step 5: Quality Check (eval, rubric)
    const rubricScores = {
      tone: Math.round((0.75 + Math.random() * 0.25) * 100) / 100,
      accuracy: Math.round((0.7 + Math.random() * 0.3) * 100) / 100,
      completeness: Math.round((0.65 + Math.random() * 0.35) * 100) / 100,
    };
    const rubricScore =
      Math.round(((rubricScores.tone + rubricScores.accuracy + rubricScores.completeness) / 3) * 100) / 100;
    const evalLatency = randInt(200, 900);
    stepExecData.push({
      stepId: evalStep.id,
      position: 5,
      status: "succeeded",
      input: { reply: draftReply },
      output: { score: rubricScore },
      retryCount: 0,
      latencyMs: evalLatency,
      createdAt: cursor,
    });
    cursor = addMs(cursor, evalLatency);

    const finishedAt = cursor;
    const run = await prisma.run.create({
      data: {
        workflowId: triageWorkflow.id,
        status: "succeeded",
        input: { ticket: { subject: ticket.subject, body: ticket.body } },
        output: { reply: draftReply, category: classification.category },
        startedAt,
        finishedAt,
        latencyMs: stepExecData.reduce((t, s) => t + (s.latencyMs ?? 0), 0),
        createdAt,
        steps: { create: stepExecData },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });

    const evalStepExec = run.steps[5];
    await prisma.evaluationResult.create({
      data: {
        runId: run.id,
        stepExecutionId: evalStepExec.id,
        evaluatorType: "rubric",
        score: rubricScore,
        passed: rubricScore >= 0.7,
        details: { criteria: rubricScores },
        createdAt: finishedAt,
      },
    });

    console.log(`  Run ${run.id} (triage, succeeded, eval score ${rubricScore})`);
  }

  // ---------------------------------------------------------------------
  // Historical runs — Content Summarizer QA
  // ---------------------------------------------------------------------
  const [summarizeStep, lengthCheckStep, titleStep, judgeStep] = summarizerWorkflow.steps;

  type SummarizerSpec = {
    articleIdx: number;
    status: "succeeded" | "failed" | "canceled";
    daysAgoStart: number;
    failAt?: "summarize";
  };

  const summarizerSpecs: SummarizerSpec[] = [
    { articleIdx: 0, status: "succeeded", daysAgoStart: 13 },
    { articleIdx: 1, status: "succeeded", daysAgoStart: 10 },
    { articleIdx: 2, status: "failed", daysAgoStart: 7, failAt: "summarize" },
    { articleIdx: 3, status: "succeeded", daysAgoStart: 5 },
    { articleIdx: 0, status: "canceled", daysAgoStart: 4 },
    { articleIdx: 1, status: "succeeded", daysAgoStart: 0 },
  ];

  for (const spec of summarizerSpecs) {
    const article = ARTICLES[spec.articleIdx];
    const createdAt = daysAgo(spec.daysAgoStart, randInt(0, 10));
    let cursor = addMs(createdAt, randInt(200, 1500));
    const startedAt = cursor;

    const stepExecData: Prisma.StepExecutionUncheckedCreateWithoutRunInput[] = [];

    const summarizeTokensIn = randInt(300, 700);
    const summarizeTokensOut = randInt(60, 180);
    const summarizeLatency = randInt(400, 3200);

    if (spec.status === "failed" && spec.failAt === "summarize") {
      const errMsg = "Mock provider returned malformed completion: unexpected end of JSON input";
      stepExecData.push({
        stepId: summarizeStep.id,
        position: 0,
        status: "failed",
        input: { article: { title: article.title, body: article.body } },
        output: Prisma.DbNull,
        errorMessage: errMsg,
        retryCount: 1,
        latencyMs: summarizeLatency,
        tokensIn: summarizeTokensIn,
        tokensOut: 0,
        costEstimate: costEstimate(summarizeTokensIn, 0),
        createdAt: cursor,
      });
      cursor = addMs(cursor, summarizeLatency + 400);
      stepExecData.push(
        { stepId: lengthCheckStep.id, position: 1, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: titleStep.id, position: 2, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: judgeStep.id, position: 3, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor }
      );
      const run = await prisma.run.create({
        data: {
          workflowId: summarizerWorkflow.id,
          status: "failed",
          input: { article: { title: article.title } },
          output: Prisma.JsonNull,
          errorMessage: errMsg,
          startedAt,
          finishedAt: cursor,
          latencyMs: cursor.getTime() - startedAt.getTime(),
          createdAt,
          steps: { create: stepExecData },
        },
      });
      console.log(`  Run ${run.id} (summarizer, failed at Summarize Content)`);
      continue;
    }

    stepExecData.push({
      stepId: summarizeStep.id,
      position: 0,
      status: "succeeded",
      input: { article: { title: article.title, body: article.body } },
      output: { summary: article.summary },
      retryCount: 0,
      latencyMs: summarizeLatency,
      tokensIn: summarizeTokensIn,
      tokensOut: summarizeTokensOut,
      costEstimate: costEstimate(summarizeTokensIn, summarizeTokensOut),
      createdAt: cursor,
    });
    cursor = addMs(cursor, summarizeLatency);

    if (spec.status === "canceled") {
      stepExecData.push(
        { stepId: lengthCheckStep.id, position: 1, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: titleStep.id, position: 2, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor },
        { stepId: judgeStep.id, position: 3, status: "skipped", input: Prisma.DbNull, output: Prisma.DbNull, retryCount: 0, createdAt: cursor }
      );
      const run = await prisma.run.create({
        data: {
          workflowId: summarizerWorkflow.id,
          status: "canceled",
          input: { article: { title: article.title } },
          output: Prisma.JsonNull,
          errorMessage: null,
          startedAt,
          finishedAt: cursor,
          latencyMs: cursor.getTime() - startedAt.getTime(),
          createdAt,
          steps: { create: stepExecData },
        },
      });
      console.log(`  Run ${run.id} (summarizer, canceled after Summarize Content)`);
      continue;
    }

    // Step 1: Length & Format Check (eval, deterministic)
    const lengthOk = article.summary.length < 500;
    const lengthLatency = randInt(5, 30);
    stepExecData.push({
      stepId: lengthCheckStep.id,
      position: 1,
      status: "succeeded",
      input: { summary: article.summary },
      output: { characterCount: article.summary.length, withinLimit: lengthOk },
      retryCount: 0,
      latencyMs: lengthLatency,
      createdAt: cursor,
    });
    cursor = addMs(cursor, lengthLatency);
    const deterministicScore = lengthOk ? 1 : 0.4;

    // Step 2: Generate Title (llm_prompt)
    const titleTokensIn = randInt(60, 160);
    const titleTokensOut = randInt(10, 40);
    const titleLatency = randInt(300, 1600);
    stepExecData.push({
      stepId: titleStep.id,
      position: 2,
      status: "succeeded",
      input: { summary: article.summary },
      output: { title: article.generatedTitle },
      retryCount: 0,
      latencyMs: titleLatency,
      tokensIn: titleTokensIn,
      tokensOut: titleTokensOut,
      costEstimate: costEstimate(titleTokensIn, titleTokensOut),
      createdAt: cursor,
    });
    cursor = addMs(cursor, titleLatency);

    // Step 3: Judge Title Relevance (eval, llm_judge)
    const judgeScore = Math.round((0.6 + Math.random() * 0.4) * 100) / 100;
    const judgeLatency = randInt(400, 2000);
    stepExecData.push({
      stepId: judgeStep.id,
      position: 3,
      status: "succeeded",
      input: { title: article.generatedTitle, summary: article.summary },
      output: { score: judgeScore },
      retryCount: 0,
      latencyMs: judgeLatency,
      createdAt: cursor,
    });
    cursor = addMs(cursor, judgeLatency);

    const finishedAt = cursor;
    const run = await prisma.run.create({
      data: {
        workflowId: summarizerWorkflow.id,
        status: "succeeded",
        input: { article: { title: article.title } },
        output: { title: article.generatedTitle, summary: article.summary },
        startedAt,
        finishedAt,
        latencyMs: stepExecData.reduce((t, s) => t + (s.latencyMs ?? 0), 0),
        createdAt,
        steps: { create: stepExecData },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });

    const lengthCheckExec = run.steps[1];
    const judgeExec = run.steps[3];
    await prisma.evaluationResult.create({
      data: {
        runId: run.id,
        stepExecutionId: lengthCheckExec.id,
        evaluatorType: "deterministic" as EvaluatorType,
        score: deterministicScore,
        passed: lengthOk,
        details: {
          checks: [
            { type: "max_length", passed: lengthOk, detail: `length ${article.summary.length} ${lengthOk ? "<=" : ">"} 500` },
            { type: "min_length", passed: article.summary.length >= 10, detail: `length ${article.summary.length} >= 10` },
          ],
        },
        createdAt: run.steps[1].createdAt,
      },
    });
    await prisma.evaluationResult.create({
      data: {
        runId: run.id,
        stepExecutionId: judgeExec.id,
        evaluatorType: "llm_judge" as EvaluatorType,
        score: judgeScore,
        passed: judgeScore >= 0.7,
        details: {
          rationale:
            judgeScore >= 0.7
              ? "Title accurately reflects the summary's main claim and is concise."
              : "Title is on-topic but slightly generic relative to the summary's specific claim.",
          judgeModel: "mock-judge-v1",
        },
        createdAt: finishedAt,
      },
    });

    console.log(`  Run ${run.id} (summarizer, succeeded, judge score ${judgeScore})`);
  }

  const [workflowCount, runCount, stepExecCount, evalCount] = await Promise.all([
    prisma.workflow.count(),
    prisma.run.count(),
    prisma.stepExecution.count(),
    prisma.evaluationResult.count(),
  ]);
  console.log(
    `Seed complete: ${workflowCount} workflows, ${runCount} runs, ${stepExecCount} step executions, ${evalCount} evaluation results.`
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
