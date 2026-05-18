const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createLinkedInProfilePlan,
  inferHeadline,
  inferSkills,
} = require("../src/platforms_chrome/linkedinAdapter");

test("LinkedIn profile plan proposes truthful public profile updates from resume text", () => {
  const plan = createLinkedInProfilePlan({
    resume: "熟悉 React、TypeScript、Node.js 和 OpenAI API，有自动化项目经历。",
    profilePatch: {
      headline: "Frontend Developer | React, TypeScript, Web Automation",
      about: "熟悉 React、TypeScript、Node.js 和 OpenAI API，有自动化项目经历。",
      skills: ["React", "TypeScript", "Node.js", "OpenAI API"],
    },
    pageText: "Peter LinkedIn Profile",
  });

  assert.equal(plan.headline, "Frontend Developer | React, TypeScript, Web Automation");
  assert.deepEqual(
    plan.actions.map((action) => action.type),
    ["edit-headline", "add-about", "add-skills"]
  );
});

test("LinkedIn profile plan avoids duplicate existing content", () => {
  const plan = createLinkedInProfilePlan({
    resume: "React TypeScript Node.js",
    profilePatch: {
      headline: "Frontend Developer | React, TypeScript, Web Automation",
      about: "React TypeScript Node.js",
      skills: ["React", "TypeScript", "Node.js"],
    },
    pageText: "Frontend Developer | React, TypeScript, Web Automation React TypeScript Node.js",
  });

  assert.deepEqual(plan.actions, []);
});

test("LinkedIn helpers infer a concise headline and skills", () => {
  assert.equal(
    inferHeadline("React TypeScript Node.js 自动化项目"),
    "Full-stack Developer | React, Node.js, Automation"
  );
  assert.deepEqual(inferSkills("React Node.js OpenAI API 自动化"), [
    "React",
    "Node.js",
    "OpenAI API",
  ]);
});
