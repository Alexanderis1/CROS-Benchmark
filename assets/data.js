/*
 * CROS Benchmark — results data.
 *
 * This is the single place to edit when new results come in.
 * Every number on the page is read from here.
 *
 * Two tracks:
 *
 *   execution  the model does the task — delivered work, time and cost
 *   planning   the model reads an unfamiliar codebase and reviews a plan
 *              against it, without writing code — six graded metrics
 *
 * Shared fields
 *   id      stable key; use the same id for the same model on both tracks
 *   name    display name of the model
 *   effort  reasoning-effort setting the run used
 *
 * Execution fields
 *   score   CROS Execution score, 0–100, higher is better
 *   time    time spent, normalized index, lower is better
 *   cost    cost, normalized index, lower is better
 *
 * Planning fields
 *   points  points earned on each metric, out of that metric's weight
 *           (see planning.metrics). The page normalizes every metric to
 *           0–100 (points ÷ weight × 100) and sums the raw points into
 *           the CROS Planning score, 0–100. Nothing to compute by hand.
 *
 * planning.metrics
 *   key     the field name used in points
 *   label   full name, used on the charts and in the method section
 *   short   optional shorter name for the leaderboard heading
 *   weight  points the metric carries in the 100-point total
 *   about   one line on what it measures
 */
var CROS_DATA = {
  meta: {
    updated: "2026-09-06",
    status: "Preliminary",
  },

  execution: {
    tasks: 1,
    models: [
      { id: "gpt-6-astra",      name: "GPT 6 Astra",      effort: "Max",   score: 99,   time: 32, cost: 6   },
      { id: "fable-5-1",        name: "Fable 5.1",        effort: "Max",   score: 98,   time: 51, cost: 99  },
      { id: "opus-5",           name: "Opus 5",           effort: "xHigh", score: 87.5, time: 99, cost: 9   },
      { id: "muse-spark-1-3",   name: "Muse Spark 1.3",   effort: "Max",   score: 87,   time: 11, cost: 1   },
      { id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", effort: "High",  score: 86,   time: 15, cost: 2.5 },
    ],
  },

  planning: {
    tasks: 1,
    metrics: [
      { key: "accuracy",       label: "Accuracy",               weight: 25, about: "Findings that hold up when checked against the code." },
      { key: "hallucination",  label: "Hallucination",          weight: 15, about: "Freedom from invented facts. Higher means fewer invented claims." },
      { key: "reasoning",      label: "Reasoning",              weight: 15, about: "Traces that follow the code correctly from cause to effect." },
      { key: "problemSolving", label: "Problem solving",        weight: 15, about: "Mitigations that are concrete and executable in the repository." },
      { key: "codebase",       label: "Codebase understanding", short: "Codebase", weight: 15, about: "How much of the relevant code, tooling and CI the review actually read." },
      { key: "efficacy",       label: "Efficacy",               weight: 15, about: "The share of the real defects the review found." },
    ],
    models: [
      { id: "fable-5-1",        name: "Fable 5.1",        effort: "Max",   points: { accuracy: 21, hallucination: 13, reasoning: 13, problemSolving: 14, codebase: 14, efficacy: 10 } },
      { id: "opus-5",           name: "Opus 5",           effort: "xHigh", points: { accuracy: 19, hallucination: 10, reasoning: 13, problemSolving: 13, codebase: 13, efficacy:  9 } },
      { id: "gpt-6-astra",      name: "GPT 6 Astra",      effort: "Max",   points: { accuracy: 20, hallucination: 13, reasoning: 12, problemSolving:  9, codebase: 11, efficacy:  9 } },
      { id: "muse-spark-1-3",   name: "Muse Spark 1.3",   effort: "Max",   points: { accuracy: 19, hallucination: 14, reasoning:  9, problemSolving: 11, codebase:  8, efficacy:  6 } },
      { id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", effort: "High",  points: { accuracy: 14, hallucination:  8, reasoning:  8, problemSolving:  9, codebase:  7, efficacy:  6 } },
    ],
  },
};
