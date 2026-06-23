const test = require("node:test");
const assert = require("node:assert/strict");

const { createNowcoderAdapter } = require("../src/platforms/nowcoder");

test("Nowcoder adapter routes platform work through computer-use", async () => {
  const requests = [];
  const adapter = createNowcoderAdapter({
    computerUse: {
      async request(request) {
        requests.push(request);
        if (request.action === "read-next-job") {
          return {
            job: {
              title: "Node.js 实习生",
              company: "靠谱科技",
              salary: "200-300元/天",
              description: "自动化工具开发",
            },
          };
        }
        if (request.action === "browse-market") {
          return { jobs: [{ title: "AI 前端", description: "React" }] };
        }
        return { ok: true };
      },
    },
  });

  await adapter.login();
  const job = await adapter.getNextJob();
  await adapter.submitApplication(job, { greeting: "您好", resumePatch: { summary: "Node.js" } });
  const marketJobs = await adapter.browseMarket();

  assert.deepEqual(
    requests.map((request) => request.action),
    ["login", "read-next-job", "submit-application", "browse-market"]
  );
  assert.equal(requests.every((request) => request.platform === "nowcoder"), true);
  assert.equal(job.id, "nowcoder-1");
  assert.equal(job.title, "Node.js 实习生");
  assert.deepEqual(marketJobs, [{ title: "AI 前端", description: "React" }]);
});

test("Nowcoder adapter refuses browser work without a computer-use gateway", async () => {
  const adapter = createNowcoderAdapter();

  await assert.rejects(() => adapter.login(), /computer-use-agent/);
});
