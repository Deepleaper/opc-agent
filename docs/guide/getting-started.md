# Getting Started

## Installation

```bash
npm install -g opc-agent
```

## Create Your First Agent

```bash
# Initialize a new project
opc init my-agent --template customer-service

# Enter the project
cd my-agent

# Validate the OAD definition
opc build

# Run in sandbox mode
opc test

# Start the agent
opc run
```

## Test the Agent

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are your business hours?"}'
```

## Project Structure

```
my-agent/
├── oad.yaml       # Agent definition (OAD Schema v1)
└── README.md
```

The `oad.yaml` file defines everything about your agent: its identity, skills, channels, and configuration.
