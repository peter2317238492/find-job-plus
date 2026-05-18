const { ResumeStore } = require("./src/resumeStore");
const { sleep } = require("./src/utils");

async function getResumeInfo(resumePath = "./简历基本信息.txt") {
  const store = new ResumeStore({ resumePath });
  return store.load();
}

module.exports = {
  getResumeInfo,
  sleep,
};
