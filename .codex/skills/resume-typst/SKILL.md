---
name: resume-typst
description: Tailor a Chinese resume to a specific job using only the source resume and job requirements, then render a Typst/PDF resume with the Chinese-Resume-in-Typst-main template.
---

# Resume Typst

Use this skill when tailoring a resume for a job application, generating a Typst resume, compiling a tailored PDF, or updating the job-specific resume workflow.

## Workflow

1. Read the source resume through `ResumeStore`; do not log private resume text.
2. Compare the job description with the source resume. Emphasize only skills, projects, education, outcomes, and availability already supported by the resume.
3. Produce a structured patch with `summary`, `highlights`, `skills`, and optional `projects`. Leave uncertain fields blank.
4. Render with `src/resume/typstResumeRenderer.js`, using the template directory `Chinese-Resume-in-Typst-main`.
5. Compile with the local `typst` binary only when the caller enables PDF generation.

## Safety

- Never invent employers, education, awards, certifications, metrics, dates, or technologies.
- Do not add contact details that are not present in the source resume.
- Treat the generated PDF as private user data. Uploading it to Boss, Nowcoder, LinkedIn, or any third party is a GUI/data-transmission task and must go through the executor confirmation path.

## Project Hooks

- Runtime renderer: `src/resume/typstResumeRenderer.js`
- Conservative tailoring helpers: `src/resume/resumeTailor.js`
- Typst escaping: `src/resume/typstEscape.js`
- Template root: `Chinese-Resume-in-Typst-main`
