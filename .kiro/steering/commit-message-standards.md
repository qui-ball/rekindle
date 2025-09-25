# AI Commit Message Standards

## Instructions for AI Agent

When generating git commit messages, ALWAYS follow this format:

```
<type>: <concise subject> (≤50 characters)

[optional body if needed - keep brief]
[task reference if applicable]
```

## Types to Use
- `feat:` - New features
- `fix:` - Bug fixes  
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `chore:` - Build/config/dependency changes

## Examples
✅ **Good:**
- `feat: add camera capture component`
- `fix: resolve HTTPS certificate issue`
- `docs: update setup instructions`
- `test: add camera permission tests`

❌ **Too verbose:**
- `feat: implement comprehensive camera capture functionality with react-camera-pro integration, HTTPS development server setup, mobile testing support, and complete test coverage including unit tests for all camera states and error handling scenarios`

## Rules
- Keep subject line under 50 characters
- Use imperative mood ("add" not "added")
- No period at end of subject
- Be concise and specific
- Reference task numbers when relevant (e.g., "Completes task 4.1")

## Enforcement
This file is automatically included in all Kiro sessions to ensure consistent commit message formatting by the AI agent.