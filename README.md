# CROS-Benchmark

A benchmark for evaluating AI coding models on short (&lt;2h), complex software engineering
tasks across C, C++, ROS1/ROS2, robotics, testing, debugging, and real-world development
workflows.

**Results page:** https://alexanderis1.github.io/CROS-Benchmark/

## What is in this repo

| Path | What it is |
| --- | --- |
| `index.html` | The results page |
| `assets/data.js` | **The results themselves — edit this to update the page** |
| `assets/app.js` | Draws the charts and the table |
| `assets/styles.css` | Styling, light and dark theme |

The page is plain HTML, CSS and JavaScript. No build step, no dependencies, no tracking.

## Turning on GitHub Pages

You only need to do this once, in the repository settings. Pick either option:

**Option A — deploy from a branch (simplest)**

1. Go to **Settings → Pages**.
2. Under *Build and deployment*, set **Source** to `Deploy from a branch`.
3. Choose branch `main` and folder `/ (root)`, then **Save**.

**Option B — deploy with the included workflow (no settings needed)**

`.github/workflows/pages.yml` runs on every push to `main`. The first run turns
Pages on by itself and publishes the site; later pushes just republish it.

Either way the site appears at `https://alexanderis1.github.io/CROS-Benchmark/` a minute
or two later. No custom domain is needed.

## Updating the results

Open `assets/data.js` and edit the `CROS_DATA` list. Every number on the page — the charts, the
leaderboard, the summary tiles and the "what stands out" notes — is read from here.

```js
{ id: "gpt-6-astra", name: "GPT 6 Astra", effort: "Max", score: 99, time: 32, cost: 6 },
```

- `score` — CROS score, 0 to 100, higher is better
- `time` — normalized time index, lower is better
- `cost` — normalized cost index, lower is better
- `effort` — the reasoning effort the run used (it is part of the result)

Also bump `meta.updated` and `meta.tasks`. Adding or removing a model needs no other
change: the charts and the table resize themselves.

## Previewing locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## License

[AGPL-3.0](LICENSE)
