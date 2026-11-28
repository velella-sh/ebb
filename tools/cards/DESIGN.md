# Lifecycle card layout

Each SVG is 960 units wide and 262–535 units high. The top shows the Ebb mark, product and UTC build date. Allow eight rows, each 39 units tall, ordered newest first. The SVG reports how many rows it shows if there are more than eight.

| Area | Contents |
| --- | --- |
| Left column | Release line |
| Time axis | Shared date scale, support segments and dotted build-date marker |
| Right column | Published or predicted end, plus phase or confidence details |
| Footer | Legend and evidence link |

Use Ebb green (#3F6E66 on light backgrounds and #7AA89F in dark mode) for standard coverage, a thinner bar for maintenance or security, and purple for optional extended coverage. Use a dashed estimate and a thin range mark for predictions. Give each dot or segment a text equivalent. Apply `prefers-color-scheme` and use system fonts.

The Node.js preview shows standard and maintenance segments. The Ubuntu preview shows optional extensions and month-level dates.

```sh
npm run build:static-api
open dist/site/api/v1/cards/generic/nodejs.svg dist/site/api/v1/cards/generic/ubuntu.svg
```

Node.js uses the checked-in runtime release history and the [Node.js Release Working Group schedule](https://github.com/nodejs/Release/blob/main/schedule.json). Ubuntu uses [Canonical's Ubuntu release cycle table](https://ubuntu.com/about/release-cycle), where dates are given by month. The card preserves that precision and plots month-only markers at the beginning of the month.

The output test uses Python 3 to parse every SVG as XML.
