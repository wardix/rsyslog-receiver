# Rsyslog HTTP Receiver

Backend HTTP service untuk menerima log dari rsyslog via omhttp module.

## Features

- **Multi-user basic auth** - Dukungan multiple users via `users.json`
- **Flexible log filtering** - Rule-based matching dengan operators: equals, contains, regex, not_equals, not_contains
- **Extensible actions** - Webhook (dengan custom headers), log to file, console output
- **Prometheus metrics** - `/metrics` endpoint untuk monitoring

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Start production server
bun run start
```

## Configuration

### Environment Variables

```bash
PORT=3000  # Default: 3000
```

### Users (`users.json`)

```json
{
  "users": [
    { "username": "rsyslog-server1", "password": "secret1" },
    { "username": "rsyslog-server2", "password": "secret2" }
  ]
}
```

### Rules (`rules.json`)

```json
{
  "rules": [
    {
      "name": "error_logs",
      "match": {
        "field": "severity",
        "operator": "equals",
        "value": "error"
      },
      "actions": [
        {
          "type": "webhook",
          "config": {
            "url": "https://example.com/webhook",
            "method": "POST",
            "headers": {
              "Authorization": "Bearer token123"
            }
          }
        }
      ]
    }
  ]
}
```

#### Match Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact match |
| `not_equals` | Not equal |
| `contains` | Substring match |
| `not_contains` | Not contains |
| `regex` | Regular expression |

#### Action Types

| Type | Config | Description |
|------|--------|-------------|
| `webhook` | `url`, `method`, `headers` | HTTP request ke URL |
| `log_to_file` | `path` | Append ke file |
| `console` | `prefix` | Print ke stdout |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/logs` | Basic | Receive log(s) |
| GET | `/metrics` | None | Prometheus metrics |
| GET | `/health` | None | Health check |

## Rsyslog Configuration

```
module(load="omhttp")

template(name="json_log" type="list") {
    constant(value="{")
    constant(value="\"timestamp\":\"")     property(name="timereported" dateFormat="rfc3339")
    constant(value="\",\"host\":\"")       property(name="hostname")
    constant(value="\",\"severity\":\"")   property(name="syslogseverity-text")
    constant(value="\",\"facility\":\"")   property(name="syslogfacility-text")
    constant(value="\",\"tag\":\"")        property(name="syslogtag")
    constant(value="\",\"message\":\"")    property(name="msg" format="json")
    constant(value="\"}")
}

action(
    type="omhttp"
    server="localhost"
    serverport="3000"
    restpath="logs"
    template="json_log"
    httpcontenttype="application/json"
    usehttps="off"
    uid="rsyslog-server1"
    pwd="changeme1"
)
```

## Prometheus Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `rsyslog_logs_received_total` | Counter | - | Total logs received |
| `rsyslog_logs_matched_total` | Counter | `rule_name` | Logs matched by rules |
| `rsyslog_actions_triggered_total` | Counter | `action_type`, `rule_name` | Actions triggered |
| `rsyslog_log_processing_duration_seconds` | Histogram | - | Processing duration |
