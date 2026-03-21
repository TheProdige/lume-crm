---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

## Process

1. **Decide** what you want the skill to do and roughly how it should do it
2. **Write** a draft of the skill
3. **Create** test prompts and run claude-with-access-to-the-skill on them
4. **Evaluate** results both qualitatively and quantitatively
5. **Rewrite** the skill based on feedback
6. **Repeat** until satisfied
7. **Expand** the test set and try again at larger scale

## Skill File Format

Skills are Markdown files with YAML frontmatter:

```markdown
---
name: my-skill
description: One clear sentence about when to use this skill
---

# Skill content here
Instructions, examples, guidelines...
```

### Key Fields
- `name`: kebab-case identifier
- `description`: Controls when the skill triggers — must be specific and action-oriented

## Writing Good Skills

### Description (Critical)
- Be specific about WHEN to trigger
- Include concrete examples of triggering phrases
- Specify what NOT to trigger on
- Use action words: "Use when the user wants to..."

### Body Structure
1. **Context**: What this skill does and why
2. **Process**: Step-by-step instructions
3. **Examples**: Input/output pairs
4. **Constraints**: What to avoid
5. **Quality Criteria**: How to evaluate output

### Best Practices
- Keep skills narrow and operational
- One skill = one clear responsibility
- Include both positive and negative examples
- Define the output format explicitly
- Test with edge cases
