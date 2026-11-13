const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeMediaUrl(value, fallback = "") {
  const candidate = String(value ?? "").trim();
  if (
    candidate.startsWith("./") ||
    candidate.startsWith("/") ||
    candidate.startsWith("https://") ||
    candidate.startsWith("http://") ||
    candidate.startsWith("data:image/") ||
    candidate.startsWith("data:video/")
  ) {
    return candidate;
  }
  return fallback;
}

function setText(selector, value) {
  const element = $(selector);
  if (element != null) element.textContent = String(value ?? "");
}

function setHtml(selector, value) {
  const element = $(selector);
  if (element != null) element.innerHTML = String(value ?? "");
}

function projectMarkup(project, index) {
  const headingId = `project-${index + 1}`;
  const visualClass = project.layout === "portrait" ? "project-visual portrait" : "project-visual";
  const cover = safeMediaUrl(project.cover, "./assets/images/qiujin-hero.jpg");
  const video = safeMediaUrl(project.video?.src);
  const poster = safeMediaUrl(project.video?.poster, cover);
  const tags = (project.tags || [])
    .map((tag) => `<li>${escapeHtml(tag)}</li>`)
    .join("");
  const stats = (project.stats || [])
    .map(
      (stat) =>
        `<div class="stat"><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></div>`,
    )
    .join("");
  const gallery = (project.gallery || [])
    .slice(0, 3)
    .map((item) => {
      const image = safeMediaUrl(item.image);
      if (!image) return "";
      return `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(item.alt || "")}" loading="lazy"><figcaption>${escapeHtml(item.caption || "")}</figcaption></figure>`;
    })
    .join("");

  return `
    <article class="project reveal visible" aria-labelledby="${headingId}">
      <div class="project-grid">
        <div class="${visualClass}">
          <span class="project-number">${escapeHtml(project.number)}</span>
          <img class="main-image" src="${escapeHtml(cover)}" alt="${escapeHtml(project.coverAlt || project.title)}">
          <span class="visual-caption">${escapeHtml(project.coverCaption || "")}</span>
        </div>
        <div class="project-copy">
          <p class="project-kicker">${escapeHtml(project.kicker || "")}</p>
          <h3 id="${headingId}">${escapeHtml(project.title || "")}</h3>
          <p class="project-en">${escapeHtml(project.english || "")}</p>
          <p class="project-description">${escapeHtml(project.description || "")}</p>
          <ul class="tags" aria-label="项目标签">${tags}</ul>
          <div class="project-stats" aria-label="项目数据">${stats}</div>
        </div>
      </div>
      <div class="project-detail">
        <div class="clip-card">
          ${
            video
              ? `<video controls playsinline preload="metadata" poster="${escapeHtml(poster)}">
                  <source src="${escapeHtml(video)}" type="video/mp4">
                  你的浏览器暂不支持视频播放。
                </video>`
              : `<div class="video-empty">暂未设置视频</div>`
          }
          <div class="clip-meta">
            <span>${escapeHtml(project.video?.label || "")}</span>
            <span>${escapeHtml(project.video?.index || "")}</span>
          </div>
        </div>
        <div class="detail-gallery" aria-label="${escapeHtml(project.title || "")}视觉资产">${gallery}</div>
      </div>
    </article>
  `;
}

function methodMarkup(method) {
  const steps = (method.steps || [])
    .map(
      (step) => `
        <div class="step">
          <span class="step-index">${escapeHtml(step.index || "")}</span>
          <h4>${escapeHtml(step.title || "")}</h4>
          <p>${escapeHtml(step.description || "")}</p>
        </div>
      `,
    )
    .join("");
  const capabilities = (method.capabilities || [])
    .map(
      (capability) => `
        <div class="capability">
          <strong>${escapeHtml(capability.title || "")}</strong>
          <span>${escapeHtml(capability.description || "")}</span>
        </div>
      `,
    )
    .join("");

  setText(".method-section .section-label", method.label);
  setText("#process-title", method.title);
  setText(".method-heading p", method.intro);
  setHtml(".process", steps);
  setHtml(".capabilities", capabilities);
}

async function applyContent(content) {
  setText("title", content.meta?.pageTitle);
  $('meta[name="description"]')?.setAttribute("content", content.meta?.description || "");

  setText(".brand span:last-child", content.site?.brand);
  setText(".footer-inner span:first-child", content.site?.footerLabel || content.meta?.pageTitle);
  const navLinks = $$(".topbar nav a");
  (content.site?.navigation || []).forEach((item, index) => {
    if (!navLinks[index]) return;
    navLinks[index].textContent = item.label;
    navLinks[index].href = item.href;
  });

  setText(".hero .eyebrow", content.hero?.eyebrow);
  const heroTitle = $("#hero-title");
  if (heroTitle) {
    heroTitle.replaceChildren();
    const [primaryTitle, ...remainder] = String(content.hero?.title || "").split("\n");
    heroTitle.append(document.createTextNode(primaryTitle));
    if (remainder.length) {
      heroTitle.append(document.createElement("br"));
      heroTitle.append(document.createTextNode(remainder.join(" ")));
    }
    if (content.hero?.subtitle) {
      const subtitle = document.createElement("span");
      subtitle.textContent = content.hero.subtitle;
      heroTitle.append(subtitle);
    }
  }
  setText(".hero-intro", content.hero?.intro);
  setHtml(
    ".hero-meta",
    (content.hero?.meta || []).map((item) => `<span>${escapeHtml(item)}</span>`).join(""),
  );
  setText(".hero-index", content.hero?.index);

  setText(".intro .section-label", content.statement?.label);
  setText("#statement-title", content.statement?.title);
  setText(".intro-note", content.statement?.note);

  setText("#works .projects-heading .section-label", content.works?.label);
  setText("#works-title", content.works?.title);
  setText("#works .projects-heading > p", content.works?.note);
  $$("#works .project").forEach((project) => project.remove());
  const projectsHtml = (content.projects || []).map(projectMarkup).join("");
  $("#works")?.insertAdjacentHTML("beforeend", projectsHtml);

  methodMarkup(content.method || {});

  setText("#about .section-label", content.contact?.label);
  setText("#about-title", content.contact?.title);
  setText("#about > p", content.contact?.description);
  let contact = $(".contact-inline");
  if (!contact) {
    contact = document.createElement("div");
    contact.className = "contact-inline";
    $("#about .closing-rule")?.before(contact);
  }
  const email = content.contact?.email || "";
  contact.innerHTML = email
    ? `<a class="contact-link" href="mailto:${escapeHtml(email)}">
        <span>${escapeHtml(content.contact?.emailLabel || "合作联系")}</span>
        <strong>${escapeHtml(email)}</strong>
      </a>`
    : "";

  setText(".footer-inner .footer-note", content.contact?.footerNote || "");
}

async function boot() {
  const previewDraft = new URLSearchParams(window.location.search).has("preview")
    ? localStorage.getItem("portfolioDraft")
    : null;
  if (previewDraft) {
    try {
      await applyContent(JSON.parse(previewDraft));
      $$(".reveal").forEach((element) => element.classList.add("visible"));
      return;
    } catch (error) {
      console.error("Portfolio draft could not be loaded:", error);
    }
  }
  try {
    const response = await fetch(`./content.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`content.json returned ${response.status}`);
    await applyContent(await response.json());
  } catch (error) {
    console.error("Portfolio content could not be loaded:", error);
  } finally {
    $$(".reveal").forEach((element) => {
      if (!element.classList.contains("visible")) element.classList.add("visible");
    });
  }
}

boot();
