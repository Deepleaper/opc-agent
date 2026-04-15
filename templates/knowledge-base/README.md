# Knowledge Base Template

RAG-powered knowledge base agent that answers questions from your company docs.

## Features
- **Semantic Search**: Uses DeepBrain for intelligent document retrieval
- **Document Ingestion**: Add docs to build your knowledge base
- **Source Citations**: Cites sources in answers

## Quick Start
```bash
opc init my-kb --template knowledge-base
cd my-kb
# Optional: install deepbrain for full RAG support
npm install deepbrain
opc run
```

## How It Works
1. Ingest company documents into DeepBrain
2. User asks a question
3. Agent searches for relevant document chunks
4. LLM generates answer based on retrieved context

## Configuration
- `memory.longTerm.provider: deepbrain` — enables semantic memory
- `memory.longTerm.collection` — DeepBrain collection name
- Falls back to in-memory if deepbrain is not installed
