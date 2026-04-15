# Sales Assistant Template

AI-powered sales assistant for product Q&A, lead capture, and appointment booking.

## Features
- **Product Q&A**: Answers questions about your products/services
- **Lead Capture**: Collects prospect information (name, email, company)
- **Appointment Booking**: Schedules demos and meetings

## Quick Start
```bash
opc init my-sales-bot --template sales-assistant
cd my-sales-bot
opc run
```

## Configuration
Edit `oad.yaml` to customize:
- System prompt with your product details
- Add your product FAQ data
- Configure appointment scheduling rules

## Value Metrics
- `leads_captured` — Number of leads collected
- `appointments_booked` — Demos/meetings scheduled
- `conversion_rate` — Lead to appointment ratio
