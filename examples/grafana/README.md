# Grafana Dashboard & Monitoring Stack Example

This directory contains a complete local monitoring stack (Prometheus, node_exporter, and Grafana) configured to ingest Ebb's OpenMetrics stream and display lifecycle metrics.

## Stack Components

- **Prometheus (`v2.54.1`)**: Scrapes node_exporter every 2 seconds.
- **node_exporter (`v1.8.2`)**: Exposes host and textfile collector metrics from `./textfile/`.
- **Grafana (`11.3.0`)**: Automatically provisions the Prometheus datasource and the prebuilt "Ebb Software Lifecycle" dashboard (`dashboard.json`).

## Quick Start

1. Start the stack:
   ```bash
   docker compose up -d
   ```

2. Open Grafana:
   Visit [http://localhost:3000](http://localhost:3000) (anonymous admin access enabled, or login with `admin`/`admin`).
   Navigate to Dashboards -> "Ebb Software Lifecycle".

3. Inspect Prometheus:
   Visit [http://localhost:9090](http://localhost:9090) and query `ebb_component_days_left` or `ebb_component_status`.

4. Stop the stack:
   ```bash
   docker compose down
   ```
