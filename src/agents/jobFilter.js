function parseSalaryRange(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const range = text.match(/(\d+(?:\.\d+)?)\s*[-~－到]\s*(\d+(?:\.\d+)?)\s*([kK万])/);
  const single = text.match(/(\d+(?:\.\d+)?)\s*([kK万])/);
  const match = range || single;

  if (!match) {
    return null;
  }

  const unit = range ? match[3] : match[2];
  const min = Number(match[1]);
  const max = range ? Number(match[2]) : min;
  const multiplier = unit === "万" ? 10 : 1;
  const monthsMatch = text.match(/(\d+)\s*薪/);
  const months = monthsMatch ? Number(monthsMatch[1]) : 12;
  const minK = min * multiplier;
  const maxK = max * multiplier;

  return {
    minK,
    maxK,
    months,
    yearlyMinK: minK * months,
    yearlyMaxK: maxK * months,
  };
}

function parseActivityDays(value) {
  if (!value) {
    return null;
  }

  const text = String(value);
  if (/刚刚|今日|今天|在线/.test(text)) {
    return 0;
  }

  const dayMatch = text.match(/(\d+)\s*(日|天)/);
  if (dayMatch) {
    return Number(dayMatch[1]);
  }

  const weekMatch = text.match(/(\d+)\s*周/);
  if (weekMatch) {
    return Number(weekMatch[1]) * 7;
  }

  const monthMatch = text.match(/(\d+)\s*月/);
  if (monthMatch) {
    return Number(monthMatch[1]) * 30;
  }

  return null;
}

function isJobAllowed(job, rules = {}) {
  const reasons = [];
  const text = [
    job.title,
    job.company,
    job.location,
    job.description,
    job.requirements,
    job.tags,
  ]
    .flat()
    .filter(Boolean)
    .join("\n");
  const blockedKeywords = rules.blockedKeywords || [];
  const blockedCompanies = rules.blockedCompanies || [];

  for (const company of blockedCompanies) {
    if (job.company && job.company.includes(company)) {
      reasons.push(`公司在黑名单中: ${company}`);
      break;
    }
  }

  for (const keyword of blockedKeywords) {
    if (text.includes(keyword)) {
      reasons.push(`包含屏蔽关键词: ${keyword}`);
      break;
    }
  }

  if (rules.allowedCities?.length && !matchesAllowedCity(job, rules.allowedCities)) {
    reasons.push(`不在目标城市: ${rules.allowedCities.join(",")}`);
  }

  if (rules.requiredInternship && !matchesInternship(text)) {
    reasons.push("不是实习岗位");
  }

  if (rules.targetStartMonth && !matchesTargetStartMonth(text, rules.targetStartMonth)) {
    reasons.push(`不匹配目标开始时间: ${rules.targetStartMonth}`);
  }

  const salary = parseSalaryRange(job.salary);
  if (salary) {
    if (Number.isFinite(rules.minSalaryK) && salary.maxK < rules.minSalaryK) {
      reasons.push(`薪资低于期望下限: ${job.salary}`);
    }
    if (Number.isFinite(rules.maxSalaryK) && salary.minK > rules.maxSalaryK) {
      reasons.push(`薪资高于期望上限: ${job.salary}`);
    }
  }

  const activeDays = parseActivityDays(job.recruiterActivity);
  if (
    activeDays !== null &&
    Number.isFinite(rules.activeWithinDays) &&
    activeDays > rules.activeWithinDays
  ) {
    reasons.push(`招聘者活跃度超过阈值: ${activeDays}天`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

function matchesAllowedCity(job, allowedCities) {
  const locationText = [job.location, job.city, job.address, job.description]
    .filter(Boolean)
    .join("\n");

  return allowedCities.some((city) => locationText.includes(city));
}

function matchesInternship(text) {
  return /实习|实训|intern/i.test(text);
}

function matchesTargetStartMonth(text, targetStartMonth) {
  const [year, monthText] = String(targetStartMonth).split("-");
  const month = Number(monthText);

  if (!year || !month) {
    return false;
  }

  const monthPattern = month === 6 ? "(?:6|06|六)" : `(?:${month}|${String(month).padStart(2, "0")})`;
  const yearMonthPattern = new RegExp(
    `${year}\\s*(?:年|[-/.])\\s*${monthPattern}\\s*(?:月)?[^。；;\\n]{0,16}(?:可)?(?:入职|到岗|开始|实习)`
  );
  const monthYearPattern = new RegExp(
    `${monthPattern}\\s*月[^。；;\\n]{0,16}${year}[^。；;\\n]{0,16}(?:可)?(?:入职|到岗|开始|实习)`
  );

  return yearMonthPattern.test(text) || monthYearPattern.test(text);
}

module.exports = {
  isJobAllowed,
  matchesAllowedCity,
  matchesInternship,
  matchesTargetStartMonth,
  parseActivityDays,
  parseSalaryRange,
};
