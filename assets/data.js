/*
 * CROS Benchmark — results data.
 *
 * This is the single place to edit when new results come in.
 * Every number on the page is read from here.
 *
 *   name    display name of the model
 *   effort  reasoning-effort setting the run used
 *   score   CROS score, 0–100, higher is better
 *   time    time spent, normalized index, lower is better
 *   cost    cost, normalized index, lower is better
 */
var CROS_DATA = {
  meta: {
    updated: "2026-09-06",
    tasks: 1,
    status: "Preliminary",
  },
  models: [
    { id: "gpt-6-astra",      name: "GPT 6 Astra",      effort: "Max",   score: 99,   time: 32, cost: 6   },
    { id: "fable-5-1",        name: "Fable 5.1",        effort: "Max",   score: 98,   time: 51, cost: 99  },
    { id: "opus-5",           name: "Opus 5",           effort: "xHigh", score: 87.5, time: 99, cost: 9   },
    { id: "muse-spark-1-3",   name: "Muse Spark 1.3",   effort: "Max",   score: 87,   time: 11, cost: 1   },
    { id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", effort: "High",  score: 86,   time: 15, cost: 2.5 },
  ],
};
