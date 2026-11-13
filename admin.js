const form = document.querySelector("#editor");
const statusBox = document.querySelector("#status");
const ownerInput = document.querySelector("#repo-owner");
const repoInput = document.querySelector("#repo-name");
const branchInput = document.querySelector("#repo-branch");
const tokenInput = document.querySelector("#github-token");

const SECTION_LABELS = {
  meta: "页面信息",
  site: "品牌与导航",
  hero: "首页首屏",
  statement: "创作主张",
  works: "作品列表标题",
  projects: "代表作品",
  method: "创作方法",
  contact: "合作联系",
};

const KEY_LABELS = {
  pageTitle: "浏览器页面标题",
  description: "描述内容",
  brand: "品牌名称",
  footerLabel: "页脚品牌文字",
  navigation: "导航项目",
  label: "小标题",
  href: "跳转地址",
  eyebrow: "英文眉题",
  title: "标题",
  subtitle: "副标题",
  intro: "介绍文字",
  meta: "关键词标签",
  index: "编号",
  note: "补充说明",
  number: "作品编号",
  kicker: "作品分类",
  english: "英文名称",
  tags: "项目标签",
  stats: "项目数据",
  value: "数值",
  cover: "主视觉图片",
  coverAlt: "主视觉图片说明",
  coverCaption: "主视觉图注",
  layout: "版式比例",
  video: "代表视频",
  src: "文件地址",
  poster: "视频封面",
  gallery: "视觉资产",
  image: "图片地址",
  alt: "图片说明",
  caption: "图片图注",
  steps: "创作步骤",
  capabilities: "创作能力",
  email: "合作邮箱",
  emailLabel: "邮箱按钮文字",
  footerNote: "页脚说明",
};

const TEXTAREA_KEYS = new Set([
  "description",
  "intro",
  "note",
  "title",
  "subtitle",
  "kicker",
  "caption",
]);

const MEDIA_KEYS = new Set(["cover", "poster", "image", "src"]);
const MEDIA_TYPES = {
  cover: "image",
  poster: "image",
  image: "image",
  src: "video",
};

let currentContent = null;
let currentSha = null;
let advancedDirty = false;
let autosaveTimer = null;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function keyLabel(key) {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  return String(key)
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

function itemLabel(arrayKey, item, index) {
  const subject =
    item?.title ||
    item?.label ||
    item?.value ||
    item?.index ||
    item?.caption ||
    "";
  const names = {
    navigation: "导航",
    projects: "作品",
    stats: "数据",
    gallery: "视觉资产",
    steps: "创作步骤",
    capabilities: "创作能力",
  };
  return `${names[arrayKey] || "项目"} ${index + 1}${subject ? ` · ${subject}` : ""}`;
}

function parseFieldValue(input) {
  if (input.dataset.valueType === "lines") {
    return input.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (input.dataset.valueType === "number") {
    return Number(input.value);
  }
  return input.value;
}

function setPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
}

function getPath(target, path) {
  return path.split(".").reduce((value, part) => value?.[part], target);
}

function fieldMarkup(path, key, value) {
  const id = `field-${path.replaceAll(".", "-")}`;
  const label = keyLabel(key);
  const wide =
    TEXTAREA_KEYS.has(key) ||
    ["intro", "description", "note"].includes(key) ||
    String(value).length > 90;
  const isMedia = MEDIA_KEYS.has(key) && path.startsWith("projects.");
  const valueType = Array.isArray(value) ? "lines" : typeof value === "number" ? "number" : "text";
  const displayValue = Array.isArray(value) ? value.join("\n") : String(value ?? "");

  if (Array.isArray(value)) {
    return `
      <label class="field wide">
        <span>${escapeHtml(label)}（每行一项）</span>
        <textarea class="control" id="${id}" data-path="${escapeHtml(path)}" data-value-type="lines">${escapeHtml(displayValue)}</textarea>
      </label>
    `;
  }

  const control = wide
    ? `<textarea class="control" id="${id}" data-path="${escapeHtml(path)}" data-value-type="${valueType}">${escapeHtml(displayValue)}</textarea>`
    : `<input class="control" id="${id}" data-path="${escapeHtml(path)}" data-value-type="${valueType}" type="${key === "email" ? "email" : valueType === "number" ? "number" : "text"}" value="${escapeHtml(displayValue)}">`;

  if (!isMedia) {
    return `<label class="field${wide ? " wide" : ""}"><span>${escapeHtml(label)}</span>${control}</label>`;
  }

  const mediaType = MEDIA_TYPES[key];
  return `
    <div class="field wide">
      <label for="${id}">${escapeHtml(label)}</label>
      <div class="media-row">
        ${control}
        <button class="btn small upload-button" type="button" data-upload-target="${id}" data-media-type="${mediaType}">上传替换</button>
        <input class="upload-input" id="${id}-file" type="file" accept="${mediaType === "video" ? "video/mp4" : "image/*"}">
      </div>
    </div>
  `;
}

function renderFields(object, path, parent) {
  const grid = document.createElement("div");
  grid.className = "field-grid";
  parent.append(grid);

  Object.entries(object).forEach(([key, value]) => {
    const childPath = `${path}.${key}`;
    if (Array.isArray(value)) {
      if (value.length === 0 || value.every((item) => typeof item !== "object" || item === null)) {
        grid.insertAdjacentHTML("beforeend", fieldMarkup(childPath, key, value));
        return;
      }

      const group = document.createElement("div");
      group.className = "nested-group wide";
      group.style.gridColumn = "1 / -1";
      group.innerHTML = `<h4>${escapeHtml(keyLabel(key))}</h4>`;
      value.forEach((item, index) => {
        const itemGroup = document.createElement("div");
        itemGroup.className = "nested-group";
        itemGroup.innerHTML = `<h4>${escapeHtml(itemLabel(key, item, index))}</h4>`;
        renderFields(item, `${childPath}.${index}`, itemGroup);
        group.append(itemGroup);
      });
      grid.append(group);
      return;
    }

    if (value !== null && typeof value === "object") {
      const group = document.createElement("div");
      group.className = "nested-group wide";
      group.style.gridColumn = "1 / -1";
      group.innerHTML = `<h4>${escapeHtml(keyLabel(key))}</h4>`;
      renderFields(value, childPath, group);
      grid.append(group);
      return;
    }

    grid.insertAdjacentHTML("beforeend", fieldMarkup(childPath, key, value));
  });
}

function renderEditor(content) {
  form.replaceChildren();
  Object.entries(content).forEach(([key, value]) => {
    const section = document.createElement("section");
    section.className = "editor-section";
    section.innerHTML = `<h3>${escapeHtml(SECTION_LABELS[key] || keyLabel(key))}</h3>`;
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => item !== null && typeof item === "object")
    ) {
      const group = document.createElement("div");
      group.className = "nested-group";
      group.innerHTML = `<h4>${escapeHtml(keyLabel(key))}</h4>`;
      value.forEach((item, index) => {
        const itemGroup = document.createElement("div");
        itemGroup.className = "nested-group";
        itemGroup.innerHTML = `<h4>${escapeHtml(itemLabel(key, item, index))}</h4>`;
        renderFields(item, `${key}.${index}`, itemGroup);
        group.append(itemGroup);
      });
      section.append(group);
    } else {
      renderFields(value, key, section);
    }
    form.append(section);
  });

  const advanced = document.createElement("details");
  advanced.className = "editor-section advanced";
  advanced.innerHTML = `
    <summary>高级 JSON（可增加或删除作品、步骤和图片）</summary>
    <textarea class="control" id="advanced-json" spellcheck="false">${escapeHtml(JSON.stringify(content, null, 2))}</textarea>
    <p><button class="btn small" id="apply-json" type="button">应用 JSON 到表单</button></p>
  `;
  form.append(advanced);

  const advancedInput = document.querySelector("#advanced-json");
  advancedInput.addEventListener("input", () => {
    advancedDirty = true;
  });
  document.querySelector("#apply-json").addEventListener("click", () => {
    try {
      const parsed = JSON.parse(advancedInput.value);
      currentContent = parsed;
      advancedDirty = false;
      renderEditor(parsed);
      saveDraft(parsed);
      showStatus("JSON 已应用到表单");
    } catch (error) {
      showStatus(`JSON 格式不正确：${error.message}`, "error");
    }
  });

  form.querySelectorAll("[data-path]").forEach((input) => {
    input.addEventListener("input", () => {
      if (!advancedDirty) {
        syncAdvancedFromForm();
      }
      queueDraftSave();
    });
  });

  form.querySelectorAll(".upload-button").forEach((button) => {
    const target = document.querySelector(`#${button.dataset.uploadTarget}`);
    const fileInput = document.querySelector(`#${button.dataset.uploadTarget}-file`);
    button.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const [file] = fileInput.files;
      if (file) uploadMedia(file, button.dataset.mediaType, target);
      fileInput.value = "";
    });
  });
}

function collectFromForm() {
  if (advancedDirty) {
    try {
      return JSON.parse(document.querySelector("#advanced-json").value);
    } catch (error) {
      throw new Error(`高级 JSON 格式不正确：${error.message}`);
    }
  }

  const output = currentContent ? deepClone(currentContent) : {};
  form.querySelectorAll("[data-path]").forEach((input) => {
    setPath(output, input.dataset.path, parseFieldValue(input));
  });
  return output;
}

function syncAdvancedFromForm() {
  const advancedInput = document.querySelector("#advanced-json");
  if (!advancedInput) return;
  try {
    advancedInput.value = JSON.stringify(collectFromForm(), null, 2);
  } catch {
    // A half-written JSON draft should remain untouched.
  }
}

function queueDraftSave() {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    try {
      saveDraft(collectFromForm());
    } catch {
      // Invalid advanced JSON is not autosaved.
    }
  }, 400);
}

function saveDraft(content) {
  localStorage.setItem("portfolioDraft", JSON.stringify(content));
}

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`.trim();
  window.clearTimeout(showStatus.timeout);
  showStatus.timeout = window.setTimeout(() => {
    statusBox.className = "status";
  }, 6000);
}

function settings() {
  return {
    owner: ownerInput.value.trim(),
    repo: repoInput.value.trim(),
    branch: branchInput.value.trim() || "main",
    token: tokenInput.value.trim(),
  };
}

function persistSettings() {
  localStorage.setItem(
    "portfolioRepoSettings",
    JSON.stringify({
      owner: ownerInput.value.trim(),
      repo: repoInput.value.trim(),
      branch: branchInput.value.trim(),
    }),
  );
  sessionStorage.setItem("portfolioGithubToken", tokenInput.value.trim());
}

async function githubRequest(path, options = {}) {
  const { token } = settings();
  if (!token) throw new Error("请先填写 GitHub 访问令牌。");
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(data?.message || `GitHub API 请求失败：${response.status}`);
  }
  return data;
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64Utf8(encoded) {
  const binary = atob(String(encoded).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getRemoteContent() {
  const { owner, repo, branch, token } = settings();
  if (!token) {
    const response = await fetch(`./content.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`读取当前内容失败：${response.status}`);
    currentSha = null;
    return response.json();
  }
  const data = await githubRequest(
    `/repos/${owner}/${repo}/contents/content.json?ref=${encodeURIComponent(branch)}`,
  );
  currentSha = data.sha;
  return JSON.parse(decodeBase64Utf8(data.content));
}

async function loadOnline() {
  try {
    showStatus("正在读取线上内容…");
    persistSettings();
    const content = await getRemoteContent();
    currentContent = content;
    advancedDirty = false;
    localStorage.removeItem("portfolioDraft");
    renderEditor(content);
    showStatus("已读取线上版本", "success");
  } catch (error) {
    showStatus(error.message, "error");
  }
}

async function publish() {
  try {
    persistSettings();
    const { owner, repo, branch, token } = settings();
    if (!token) throw new Error("请先填写 GitHub 访问令牌。");
    const content = collectFromForm();
    if (!content.contact?.email?.includes("@")) {
      throw new Error("合作邮箱格式不正确。");
    }
    showStatus("正在发布到 GitHub Pages…");

    if (!currentSha) {
      try {
        const existing = await githubRequest(
          `/repos/${owner}/${repo}/contents/content.json?ref=${encodeURIComponent(branch)}`,
        );
        currentSha = existing.sha;
      } catch (error) {
        if (!String(error.message).includes("Not Found")) throw error;
      }
    }

    const payload = {
      message: `Update portfolio content ${new Date().toISOString()}`,
      content: encodeBase64Utf8(`${JSON.stringify(content, null, 2)}\n`),
      branch,
    };
    if (currentSha) payload.sha = currentSha;

    const result = await githubRequest(
      `/repos/${owner}/${repo}/contents/content.json`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
    currentSha = result.content?.sha || currentSha;
    currentContent = content;
    saveDraft(content);
    showStatus("发布成功。GitHub Pages 通常会在 1–2 分钟内更新。", "success");
  } catch (error) {
    showStatus(`发布失败：${error.message}`, "error");
  }
}

async function uploadMedia(file, mediaType, targetInput) {
  try {
    const { owner, repo, branch, token } = settings();
    if (!token) throw new Error("上传文件前请先填写 GitHub 访问令牌。");
    if (file.size > 25 * 1024 * 1024) {
      throw new Error("单个文件不能超过 25 MB。");
    }
    if (mediaType === "image" && !file.type.startsWith("image/")) {
      throw new Error("请选择图片文件。");
    }
    if (mediaType === "video" && !file.type.startsWith("video/")) {
      throw new Error("请选择视频文件。");
    }

    showStatus(`正在上传 ${file.name}…`);
    const extension = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || "").toLowerCase();
    const base = file.name
      .slice(0, extension ? -extension.length : undefined)
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "media";
    const assetPath = `assets/uploads/${Date.now()}-${base}${extension}`;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const base64 = String(dataUrl).split(",", 2)[1];

    await githubRequest(`/repos/${owner}/${repo}/contents/${assetPath}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Upload portfolio media ${file.name}`,
        content: base64,
        branch,
      }),
    });

    targetInput.value = `./${assetPath}`;
    targetInput.dispatchEvent(new Event("input", { bubbles: true }));
    showStatus("媒体上传成功，请点击“发布到公网”保存内容。", "success");
  } catch (error) {
    showStatus(`上传失败：${error.message}`, "error");
  }
}

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("portfolioRepoSettings") || "{}");
    if (saved.owner) ownerInput.value = saved.owner;
    if (saved.repo) repoInput.value = saved.repo;
    if (saved.branch) branchInput.value = saved.branch;
  } catch {
    // Keep defaults.
  }
  tokenInput.value = sessionStorage.getItem("portfolioGithubToken") || "";
}

async function initialize() {
  restoreSettings();
  try {
    const online = await getRemoteContent();
    currentContent = online;
    const draft = localStorage.getItem("portfolioDraft");
    if (draft) {
      try {
        currentContent = JSON.parse(draft);
        showStatus("已恢复本机草稿。点击“读取线上版本”可放弃草稿。");
      } catch {
        localStorage.removeItem("portfolioDraft");
      }
    }
    renderEditor(currentContent);
  } catch (error) {
    showStatus(error.message, "error");
  }
}

document.querySelector("#open-site").addEventListener("click", () => {
  window.location.href = "./";
});

document.querySelector("#load-online").addEventListener("click", loadOnline);
document.querySelector("#publish").addEventListener("click", publish);
document.querySelector("#preview").addEventListener("click", () => {
  try {
    const content = collectFromForm();
    saveDraft(content);
    window.open("./index.html?preview=1", "_blank", "noopener");
  } catch (error) {
    showStatus(error.message, "error");
  }
});
document.querySelector("#download-json").addEventListener("click", () => {
  try {
    const content = collectFromForm();
    const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "content.json";
    link.click();
    URL.revokeObjectURL(link.href);
    showStatus("备份已下载", "success");
  } catch (error) {
    showStatus(error.message, "error");
  }
});

[ownerInput, repoInput, branchInput, tokenInput].forEach((input) => {
  input.addEventListener("change", persistSettings);
});

initialize();
