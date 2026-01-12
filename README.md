# Rsyslog HTTP Receiver

Backend HTTP service untuk menerima log dari rsyslog via omhttp module.

## Features

- **Multi-user basic auth** - Dukungan multiple users via `users.json`
- **Flexible log filtering** - Rule-based matching dengan operators: equals, contains, regex, not_equals, not_contains
- **Multiple conditions** - Support AND/OR operator untuk multiple conditions per rule
- **Extensible actions** - Webhook (dengan custom headers & template), log to file, console output
- **Repeated message reduction** - Deduplikasi pesan berulang seperti rsyslog
- **Prometheus metrics** - `/metrics` endpoint untuk monitoring

## Quick Start

```bash
# Copy example config files
cp users.json.example users.json
cp rules.json.example rules.json

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
      "conditions": [
        { "field": "severity", "operator": "equals", "value": "error" }
      ],
      "actions": [
        { "type": "console", "config": { "prefix": "[ERROR]" } }
      ]
    }
  ]
}
```

#### Multiple Conditions

Gunakan `matchOperator` untuk menggabungkan beberapa kondisi:

```json
{
  "name": "critical_server_errors",
  "matchOperator": "and",
  "conditions": [
    { "field": "host", "operator": "equals", "value": "prod-server-01" },
    { "field": "severity", "operator": "equals", "value": "error" }
  ],
  "actions": [...]
}
```

- `matchOperator: "and"` - Semua kondisi harus terpenuhi (default)
- `matchOperator: "or"` - Minimal satu kondisi harus terpenuhi

#### Condition Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact match |
| `not_equals` | Not equal |
| `contains` | Substring match |
| `not_contains` | Not contains |
| `regex` | Regular expression |

#### Action Types

##### Console

```json
{ "type": "console", "config": { "prefix": "[ERROR]" } }
```

##### Log to File

```json
{ "type": "log_to_file", "config": { "path": "/var/log/alerts.log" } }
```

##### Webhook

```json
{
  "type": "webhook",
  "config": {
    "url": "https://hooks.slack.com/services/xxx",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token"
    },
    "bodyTemplate": {
      "text": "🚨 Alert from {{host}}: {{message}}",
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "*{{severity}}* - {{message}}"
          }
        }
      ]
    }
  }
}
```

**Template placeholders:** `{{field}}` akan diganti dengan nilai dari log.
- `{{host}}`, `{{message}}`, `{{severity}}`, `{{timestamp}}`, dll.

Jika `bodyTemplate` tidak diisi, webhook akan mengirim raw log JSON.

#### Repeated Message Reduction

Deduplikasi pesan berulang (seperti rsyslog `RepeatedMsgReduction`):

```json
{
  "name": "error_logs",
  "conditions": [...],
  "repeatedMsgReduction": {
    "enabled": true,
    "timeoutSeconds": 60,
    "keyFields": ["host", "message"]
  },
  "actions": [...]
}
```

- `keyFields` - Field yang dibandingkan untuk mendeteksi duplikat
- `timeoutSeconds` - Setelah timeout, kirim summary "last message repeated X times"

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
| `rsyslog_logs_suppressed_total` | Counter | `rule_name` | Logs suppressed by deduplication |
| `rsyslog_actions_triggered_total` | Counter | `action_type`, `rule_name` | Actions triggered |
| `rsyslog_log_processing_duration_seconds` | Histogram | - | Processing duration |
