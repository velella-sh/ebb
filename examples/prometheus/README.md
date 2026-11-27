# Prometheus Textfile Collector & Alerts Example

This example demonstrates how to integrate Ebb with Prometheus using [node_exporter](https://github.com/prometheus/node_exporter)'s textfile collector.

## Architecture

Ebb is designed as an offline-first, point-in-time CLI and library. Instead of running a persistent daemon exporter that consumes memory, operators use a scheduled cron job to run `ebb check-all --format openmetrics` and write an atomic metrics textfile into node_exporter's textfile directory.

```
+------------------------------------+
| Scheduled Cron Job                |
| ebb check-all --format openmetrics |
+-----------------+------------------+
                  |
                  v (atomic write)
+------------------------------------+
| /var/lib/node_exporter/textfile/   |
| ebb.prom                           |
+-----------------+------------------+
                  |
                  v (scraped on /metrics)
+------------------------------------+
| node_exporter                      |
| (:9100/metrics)                    |
+-----------------+------------------+
                  |
                  v (scrapes series)
+------------------------------------+
| Prometheus Server                  |
| (alerts on days_left < 90)         |
+------------------------------------+
```

## 1. Cron Configuration

Add a daily crontab entry that checks your project or SBOM and writes the metrics atomically using a temporary file:

```bash
# Evaluate daily at 06:00 UTC and publish to node_exporter textfile collector
0 6 * * * ebb check-all /etc/ebb/sbom.json --format openmetrics > /var/lib/node_exporter/textfile/ebb.prom.$$ && mv /var/lib/node_exporter/textfile/ebb.prom.$$ /var/lib/node_exporter/textfile/ebb.prom
```

## 2. node_exporter Configuration

Ensure `node_exporter` is launched with the `--collector.textfile.directory` flag pointing to the metrics directory:

```bash
node_exporter --collector.textfile.directory=/var/lib/node_exporter/textfile
```

## 3. Prometheus Alert Rules

`alerts.yml` defines an alert when any monitored component has fewer than 90 days remaining until its end-of-life or deprecation deadline:

```yaml
groups:
  - name: ebb_lifecycle
    rules:
      - alert: ComponentDeadlineApproaching
        expr: ebb_component_days_left < 90
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Component {{ $labels.purl }} deadline approaching"
          description: "Component {{ $labels.purl }}@{{ $labels.version }} has {{ $value }} days remaining until {{ $labels.event }}."
```

## 4. Rule Testing with promtool

Validate alert rules offline using Prometheus's official `promtool` testing framework:

```bash
promtool test rules examples/prometheus/alerts_test.yml
```
