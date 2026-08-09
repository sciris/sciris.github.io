const markdownIt = require("markdown-it");

const md = markdownIt({ html: true, linkify: true });

const H2_STYLE =
  "padding-top:80px; margin-top:-20px; padding-bottom:20px; font-weight:bold; color:#333333;";

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("CNAME");

  eleventyConfig.setLibrary("md", md);

  // Render a markdown string (from frontmatter) to HTML.
  eleventyConfig.addFilter("md", (text) => (text ? md.render(text) : ""));
  // Same but without surrounding <p> tags (for inline contexts).
  eleventyConfig.addFilter("mdinline", (text) =>
    text ? md.renderInline(text.trim()) : ""
  );
  // Render blank-line-separated paragraphs as inline HTML joined by <br><br>.
  // Avoids the heavier paragraph styling that <p> tags get inside the footer.
  eleventyConfig.addFilter("mdpara", (text) =>
    text
      ? text
          .trim()
          .split(/\n\s*\n/)
          .map((p) => md.renderInline(p.trim()))
          .join("<br><br>")
      : ""
  );

  // {% section "id", "Title", width? %} ...markdown... {% endsection %}
  // width: "wide" -> col-md-12 content area; otherwise col-md-9 (the default).
  eleventyConfig.addPairedShortcode("section", (content, id, title, width) => {
    const colClass = width === "wide" ? "col-md-12" : "col-md-9";
    return `
<section id="${id}">
  <div class="row">
    <div class="col-md-12 ml-auto mr-auto">
      <h2 class="text-center" style="${H2_STYLE}">${title}</h2>
      <div class="row">
        <div class="${colClass} ml-auto mr-auto">
${md.render(content)}
        </div>
      </div>
    </div>
  </div>
</section>
`;
  });

  // {% cards "id", "Title" %} {% card ... %}...{% endcard %} ... {% endcards %}
  eleventyConfig.addPairedShortcode("cards", (content, id, title) => `
<section id="${id}">
  <div class="row">
    <div class="col-md-12 ml-auto mr-auto">
      <h2 class="text-center" style="${H2_STYLE}">${title}</h2>
      <div class="row">
${content}
      </div>
    </div>
  </div>
</section>
`);

  // {% card "Title", "iconName" %} ...markdown body... {% endcard %}
  // iconName is a fontawesome name e.g. "flash", "font", "life-ring"
  eleventyConfig.addPairedShortcode("card", (content, title, icon) => `
<div class="col-md-4">
  <div class="card card-blog card-top-shadow">
    <div class="card-body" style="min-height: 300px;">
      <h2 class="card-category text-center" style="font-weight:bold; font-size: 18px;">${title}</h2>
      <div class="card-image text-center">
        <img class="img img-raised" src="https://icongr.am/fontawesome/${icon}.svg?color=1b1b1b" style="width:17%; margin:5px 0; padding: 5px 0;">
      </div>
      <div class="card-description text-left" style="margin-top:10px;">
${md.render(content)}
      </div>
    </div>
  </div>
</div>
`);

  // {% columns %} {% column %}...{% endcolumn %} ... {% endcolumns %}
  // Equal-width columns of markdown; used for the feature lists.
  eleventyConfig.addPairedShortcode("columns", (content) => `
<div class="row featurecols">
${content}
</div>
`);

  eleventyConfig.addPairedShortcode("column", (content) => `
<div class="col-md-6">
${md.render(content)}
</div>
`);

  // {% cite %} ...markdown citation... {% endcite %}
  eleventyConfig.addPairedShortcode(
    "cite",
    (content) => `<p class="citation">${md.renderInline(content.trim())}</p>`
  );

  // {% topbuttons %} {% topbtn ... %} ... {% endtopbuttons %}
  eleventyConfig.addPairedShortcode("topbuttons", (content) => `
<div class="col-md-12 ml-auto mr-auto">
  <ul id="icons-links" class="text-center" style="margin-top:0px">
${content}
  </ul>
</div>
`);

  // {% topbtn "Label", "url", "iconPath", opts? %}
  // iconPath e.g. "octicons/code" or "fontawesome/lightbulb-o".
  // opts: "tight" reduces the gap between icon and label and applies
  // height=30 to the img (needed for icons that render shorter than 30px).
  eleventyConfig.addShortcode("topbtn", (label, url, icon, opts) => {
    const tight = opts === "tight";
    const sep = tight ? "&nbsp;" : "&nbsp;&nbsp;";
    const heightAttr = tight ? ' height="30"' : "";
    return `<a href="${url}" target="_blank"><button class="btn btn-primary"><img src="https://icongr.am/${icon}.svg?size=30&color=ffffff"${heightAttr}>${sep}${label}<div class="ripple-container"></div></button></a>`;
  });

  // {% examples %} {% tab "Title", "image" %}...{% endtab %} ... {% endexamples %}
  // The tab shortcode emits its rendered content wrapped in markers; the
  // examples shortcode parses those markers to build both the Bootstrap
  // nav-tabs UL and the matching tab-content panes.
  const TAB_RE = /<!--TAB:([^:]+):([\s\S]*?)-->([\s\S]*?)<!--\/TAB-->/g;

  eleventyConfig.addPairedShortcode("tab", (content, title, image) => {
    // Replace blank lines with HTML comments so markdown-it's outer pass
    // doesn't terminate the surrounding tab-pane <div> at a blank line
    // inside a fenced code block.
    const rendered = md.render(content).replace(/\n\s*\n/g, "\n<!-- -->\n");
    const imgTag = image
      ? `\n<img src="${image}" width="100%" class="card-top-shadow text-center">`
      : "";
    return `<!--TAB:${title}:image=${image || ""}-->${rendered}${imgTag}<!--/TAB-->`;
  });

  eleventyConfig.addPairedShortcode("examples", (content) => {
    const tabs = [];
    let m;
    TAB_RE.lastIndex = 0;
    while ((m = TAB_RE.exec(content))) {
      tabs.push({ title: m[1], body: m[3] });
    }
    const navItems = tabs
      .map((t, i) => {
        const id = `code_tab_${i}`;
        const active = i === 0 ? " active" : "";
        const sel = i === 0 ? "true" : "false";
        return `
            <li class="nav-item">
              <a class="nav-link nav-link-narrow${active}" href="#${id}" data-toggle="tab" role="tab" aria-selected="${sel}"><span class="tablist-text">${t.title}</span></a>
            </li>`;
      })
      .join("");
    const panes = tabs
      .map((t, i) => {
        const id = `code_tab_${i}`;
        const active = i === 0 ? " active" : "";
        return `
        <div class="tab-pane${active}" id="${id}" role="tabpanel">
          <div class="row">
            <div class="col-md-12" style="padding-top: 25px;">
${t.body}
            </div>
          </div>
        </div>`;
      })
      .join("");
    return `
<section id="examples">
  <div class="row">
    <div class="col-md-12 ml-auto mr-auto">
      <h2 class="text-center" style="${H2_STYLE}">Examples</h2>
      <div class="profile-tabs" style="margin:0px;">
        <div class="nav-tabs-navigation col-md-12 ml-auto mr-auto">
          <div class="nav-tabs-wrapper">
            <ul id="tabs" class="nav nav-tabs" role="tablist">${navItems}
            </ul>
          </div>
        </div>
        <div class="tab-content col-md-9 ml-auto mr-auto" style="padding-left:3px; padding-right:3px;">${panes}
        </div>
      </div>
    </div>
  </div>
</section>
`;
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "",
      layouts: "",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk"],
  };
};
