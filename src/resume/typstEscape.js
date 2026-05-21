function escapeTypst(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/#/g, "\\#")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/@/g, "\\@");
}

function bracket(value) {
  return `[${escapeTypst(value)}]`;
}

module.exports = {
  bracket,
  escapeTypst,
};
