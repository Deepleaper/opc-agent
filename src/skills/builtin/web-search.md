---
name: web-search
description: Search the web and summarize results
triggers: [search, find, look up, 搜索, 查找, 查询]
---
# Web Search Skill

When the user asks to search for something, use the `web_search` tool with the user's query.

Steps:
1. Extract the search query from the user message.
2. Call `web_search` with the query.
3. Summarize the top results in a concise, structured format.
4. Cite sources with URLs.
