/* Shared, dependency-free interactions for the static SGN pages. */
(() => {
  "use strict";

  const start = () => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [
      ...root.querySelectorAll(selector),
    ];
    const dialogOpeners = new WeakMap();
    const backdropStarts = new WeakMap();
    const mobileMenu = $("#mobile-menu");
    const searchDialog = $("#search-dialog");
    const dropdowns = $$("details.departments-menu");

    const readData = (id) => {
      try {
        const data = JSON.parse(
          document.getElementById(id)?.textContent || "[]",
        );
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };
    const normalize = (value) =>
      String(value || "")
        .toLocaleLowerCase("ru")
        .replace(/ё/g, "е")
        .trim();
    const safeHref = (value) => {
      if (typeof value !== "string" || !value.trim()) return null;
      try {
        const url = new URL(value, document.baseURI);
        return ["http:", "https:", "file:"].includes(url.protocol)
          ? value
          : null;
      } catch {
        return null;
      }
    };
    const closeDropdowns = () =>
      dropdowns.forEach((details) => {
        details.open = false;
      });
    const closeDialog = (dialog) => {
      if (!dialog || !dialog.open) return;
      if (typeof dialog.close === "function") dialog.close();
      else {
        dialog.removeAttribute("open");
        dialog.dispatchEvent(new Event("close"));
      }
    };
    const openDialog = (dialog, opener) => {
      if (!dialog || dialog.open) return;
      closeDropdowns();
      dialogOpeners.set(dialog, opener || document.activeElement);
      dialog.hidden = false;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    };

    $$("dialog").forEach((dialog) => {
      const outside = (event) => {
        const rect = dialog.getBoundingClientRect();
        return (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        );
      };
      dialog.addEventListener("pointerdown", (event) => {
        backdropStarts.set(dialog, event.target === dialog && outside(event));
      });
      dialog.addEventListener("click", (event) => {
        if (
          event.target === dialog &&
          outside(event) &&
          backdropStarts.get(dialog)
        )
          closeDialog(dialog);
        backdropStarts.delete(dialog);
      });
      dialog.addEventListener("close", () => {
        const opener = dialogOpeners.get(dialog);
        if (opener instanceof HTMLElement && opener.isConnected)
          opener.focus({ preventScroll: true });
        if (dialog === mobileMenu) {
          $$("[data-menu-open]").forEach((button) =>
            button.setAttribute("aria-expanded", "false"),
          );
          document.body.classList.remove("menu-open");
        }
      });
    });

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const menuOpener = event.target.closest("[data-menu-open]");
      const menuCloser = event.target.closest("[data-menu-close]");
      const dialogCloser = event.target.closest("[data-dialog-close]");
      if (menuOpener) {
        openDialog(mobileMenu, menuOpener);
        if (mobileMenu?.open) {
          menuOpener.setAttribute("aria-expanded", "true");
          document.body.classList.add("menu-open");
        }
      }
      if (menuCloser) closeDialog(mobileMenu);
      if (dialogCloser) closeDialog(dialogCloser.closest("dialog"));
      if (mobileMenu?.open && event.target.closest("#mobile-menu a[href]"))
        closeDialog(mobileMenu);
      dropdowns.forEach((details) => {
        if (!details.contains(event.target)) details.open = false;
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      dropdowns.forEach((details) => {
        if (details.open) {
          details.open = false;
          $("summary", details)?.focus();
        }
      });
    });
    dropdowns.forEach((details) => {
      details.addEventListener("toggle", () => {
        $("summary", details)?.setAttribute(
          "aria-expanded",
          String(details.open),
        );
        if (details.open)
          dropdowns
            .filter((other) => other !== details)
            .forEach((other) => {
              other.open = false;
            });
      });
    });

    // All results are created as text nodes, including user queries and editable page data.
    const searchInput = $("#site-search");
    const searchResults = $("#search-results");
    const searchIndex = readData("site-search-index").filter(
      (entry) => entry && safeHref(entry.url),
    );
    let searchTimer;
    const renderSearch = () => {
      if (!searchInput || !searchResults) return;
      const query = normalize(searchInput.value);
      searchResults.replaceChildren();
      const status = document.createElement("p");
      status.className = "search-status";
      status.setAttribute("role", "status");
      if (!query) {
        status.textContent = "Введите название кафедры, раздела или тему.";
        searchResults.append(status);
        return;
      }
      const words = query.split(/\s+/).filter(Boolean);
      const matches = searchIndex.filter((entry) => {
        const text = normalize(
          `${entry.title || ""} ${entry.description || ""}`,
        );
        return words.every((word) => text.includes(word));
      });
      status.textContent = matches.length
        ? `Найдено разделов: ${matches.length}`
        : "Ничего не найдено. Попробуйте другой запрос.";
      searchResults.append(status);
      if (!matches.length) return;
      const list = document.createElement("ul");
      list.className = "search-results-list";
      matches.forEach((entry) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.className = "search-result";
        link.href = safeHref(entry.url);
        const title = document.createElement("span");
        title.className = "search-result__title";
        title.textContent = String(entry.title || "Раздел сайта");
        link.append(title);
        if (entry.description) {
          const description = document.createElement("span");
          description.className = "search-result__description";
          description.textContent = String(entry.description);
          link.append(description);
        }
        link.addEventListener("click", () => closeDialog(searchDialog));
        item.append(link);
        list.append(item);
      });
      searchResults.append(list);
    };
    searchInput?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(renderSearch, 120);
    });
    searchInput?.closest("form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      window.clearTimeout(searchTimer);
      renderSearch();
    });
    $$("[data-search-open]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!searchInput) return;
        if (!searchInput.value)
          searchInput.value =
            new URLSearchParams(window.location.search).get("q") || "";
        renderSearch();
        openDialog(searchDialog, button);
        requestAnimationFrame(() => searchInput.focus());
      });
    });

    const filterButtons = $$("[data-news-filter]");
    const newsItems = $$("[data-news-category]");
    const moreButton = $("[data-news-more]");
    const emptyNews = $("#news-empty");
    let activeFilter =
      filterButtons
        .find((button) => button.getAttribute("aria-pressed") === "true")
        ?.getAttribute("data-news-filter") || "all";
    let expandedNews = false;
    const filterMatches = (item) =>
      activeFilter === "all" ||
      item.getAttribute("data-news-category") === activeFilter;
    const renderNews = () => {
      let visible = 0;
      newsItems.forEach((item) => {
        item.hidden =
          !filterMatches(item) ||
          (item.hasAttribute("data-news-extra") && !expandedNews);
        if (!item.hidden) visible += 1;
      });
      filterButtons.forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.getAttribute("data-news-filter") === activeFilter),
        ),
      );
      if (emptyNews) {
        emptyNews.hidden = visible !== 0;
        if (!visible)
          emptyNews.textContent = "В этой рубрике пока нет публикаций.";
      }
      if (moreButton) {
        const extras = newsItems.filter(
          (item) => item.hasAttribute("data-news-extra") && filterMatches(item),
        );
        moreButton.hidden = extras.length === 0;
        moreButton.disabled = expandedNews;
        const label = $("[data-news-more-label]", moreButton);
        if (label)
          label.textContent = expandedNews
            ? "Все новости показаны"
            : "Показать ещё";
        else
          moreButton.textContent = expandedNews
            ? "Все новости показаны"
            : "Показать ещё";
      }
    };
    filterButtons.forEach((button) =>
      button.addEventListener("click", () => {
        activeFilter = button.getAttribute("data-news-filter") || "all";
        renderNews();
      }),
    );
    moreButton?.addEventListener("click", () => {
      expandedNews = true;
      renderNews();
    });
    if (newsItems.length) renderNews();

    const accessibilityButtons = $$("[data-accessibility-toggle]");
    const accessibilityBanner = $(".accessibility-banner");
    const accessibilityResetButtons = $$("[data-accessibility-reset]");
    const preferenceKey = "sgn-accessibility-mode";
    const accessibilityFontProperty = "--accessibility-font-size";
    const accessibilityTextAttribute = "data-accessibility-text";
    const originalTextStyles = new Map();
    let accessibilityFrame = 0;

    const clearAccessibilityText = () => {
      originalTextStyles.forEach((original, element) => {
        if (original.value) {
          element.style.setProperty(
            accessibilityFontProperty,
            original.value,
            original.priority,
          );
        } else element.style.removeProperty(accessibilityFontProperty);
        if (original.attribute === null) {
          element.removeAttribute(accessibilityTextAttribute);
        } else {
          element.setAttribute(accessibilityTextAttribute, original.attribute);
        }
      });
      originalTextStyles.clear();
    };

    const measureAccessibilityText = () => {
      // Always measure the normal theme, even after a resize or a content update.
      // Each text element gets its own pixel size so nested spans never compound
      // an inherited 125% scale. Turning the mode off restores the original CSS.
      const wasEnabled = document.body.classList.contains("accessibility-mode");
      document.body.classList.remove("accessibility-mode");
      const elements = [document.body, ...$$("body *")].filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.matches("script, style, template, noscript")) return false;
        return (
          element.matches(
            "body, h1, h2, h3, h4, h5, h6, p, a, button, label, summary, input, textarea, select, option, legend, dt, dd, li",
          ) ||
          [...element.childNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
          )
        );
      });
      const measurements = elements.map((element) => {
        let normalSize = parseFloat(getComputedStyle(element).fontSize) || 0;
        // Some compact layouts replace a zero-sized text node with a CSS label.
        // Use that visible label's normal size before exposing the source text.
        for (const pseudo of ["::before", "::after"]) {
          const style = getComputedStyle(element, pseudo);
          if (
            style.content &&
            !["none", "normal", '""', "''"].includes(style.content)
          ) {
            normalSize = Math.max(normalSize, parseFloat(style.fontSize) || 0);
          }
        }
        return {
          element,
          size: Math.max(22, Math.ceil(normalSize * 125) / 100),
        };
      });
      measurements.forEach(({ element, size }) => {
        if (!originalTextStyles.has(element)) {
          originalTextStyles.set(element, {
            value: element.style.getPropertyValue(accessibilityFontProperty),
            priority: element.style.getPropertyPriority(
              accessibilityFontProperty,
            ),
            attribute: element.getAttribute(accessibilityTextAttribute),
          });
        }
        element.style.setProperty(accessibilityFontProperty, `${size}px`);
        element.setAttribute(accessibilityTextAttribute, "");
      });
      if (wasEnabled) document.body.classList.add("accessibility-mode");
    };

    const scheduleAccessibilityMeasurement = () => {
      if (
        !document.body.classList.contains("accessibility-mode") ||
        accessibilityFrame
      )
        return;
      accessibilityFrame = requestAnimationFrame(() => {
        accessibilityFrame = 0;
        if (document.body.classList.contains("accessibility-mode")) {
          measureAccessibilityText();
        }
      });
    };

    const setAccessibility = (enabled) => {
      if (enabled) measureAccessibilityText();
      document.body.classList.toggle("accessibility-mode", enabled);
      if (!enabled) {
        cancelAnimationFrame(accessibilityFrame);
        accessibilityFrame = 0;
        clearAccessibilityText();
      }
      if (accessibilityBanner) accessibilityBanner.hidden = !enabled;
      $$('[data-department-tabs][role="tablist"]').forEach((tablist) =>
        tablist.setAttribute(
          "aria-orientation",
          enabled ? "vertical" : "horizontal",
        ),
      );
      accessibilityButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(enabled));
        button.setAttribute(
          "aria-label",
          enabled ? "Вернуться к обычной версии" : "Версия для слабовидящих",
        );
      });
    };
    const saveAccessibility = (enabled) => {
      setAccessibility(enabled);
      try {
        localStorage.setItem(preferenceKey, String(enabled));
      } catch {
        /* The current page still works when storage is blocked. */
      }
    };
    let savedAccessibility = false;
    try {
      savedAccessibility = localStorage.getItem(preferenceKey) === "true";
    } catch {
      /* Storage can be disabled. */
    }
    setAccessibility(savedAccessibility);
    accessibilityButtons.forEach((button) =>
      button.addEventListener("click", () => {
        const enabled = !document.body.classList.contains("accessibility-mode");
        saveAccessibility(enabled);
      }),
    );
    accessibilityResetButtons.forEach((button) =>
      button.addEventListener("click", () => {
        saveAccessibility(false);
        accessibilityButtons
          .find((toggle) => toggle.getClientRects().length)
          ?.focus({ preventScroll: true });
      }),
    );
    window.addEventListener("resize", scheduleAccessibilityMeasurement, {
      passive: true,
    });
    // Search results are created after initial page load.
    // Observe their content, not our style/ARIA attributes, to avoid feedback loops.
    if ("MutationObserver" in window) {
      new MutationObserver(scheduleAccessibilityMeasurement).observe(
        document.body,
        {
          childList: true,
          characterData: true,
          subtree: true,
        },
      );
    }

    $$("[data-department-tabs]").forEach((tablist) => {
      const entries = $$("[data-department-tab]", tablist)
        .map((tab) => {
          let id;
          try {
            id = decodeURIComponent(tab.hash.slice(1));
          } catch {
            return null;
          }
          const panel = document.getElementById(id);
          return panel?.hasAttribute("data-department-panel")
            ? { tab, panel }
            : null;
        })
        .filter(Boolean);
      if (entries.length < 2) return;

      tablist.setAttribute("role", "tablist");
      tablist.setAttribute(
        "aria-orientation",
        document.body.classList.contains("accessibility-mode")
          ? "vertical"
          : "horizontal",
      );
      entries.forEach(({ tab, panel }) => {
        if (!tab.id) tab.id = `department-tab-${panel.id}`;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
        panel.tabIndex = 0;
      });
      tablist.closest(".department-layout")?.classList.add("is-tabbed");

      const select = (selected, { focus = false, historyMode = null } = {}) => {
        entries.forEach(({ tab, panel }) => {
          const active = panel === selected.panel;
          tab.setAttribute("aria-selected", String(active));
          tab.classList.toggle("is-active", active);
          tab.tabIndex = active ? 0 : -1;
          panel.hidden = !active;
        });
        if (historyMode) {
          const url = new URL(window.location.href);
          url.hash = selected.panel.id;
          if (url.href !== window.location.href) {
            window.history[
              historyMode === "replace" ? "replaceState" : "pushState"
            ](null, "", url);
          }
        }
        if (focus) selected.tab.focus({ preventScroll: true });
        scheduleAccessibilityMeasurement();
        if (historyMode) {
          // A sticky tab can be activated halfway down a long panel. Reveal the
          // new panel's beginning; in reading mode keep the vertical tabs in view.
          const scrollTarget = document.body.classList.contains(
            "accessibility-mode",
          )
            ? tablist
            : selected.panel;
          requestAnimationFrame(() =>
            scrollTarget.scrollIntoView({
              block: "start",
              behavior: "instant",
            }),
          );
        }
      };
      const selectFromHash = () => {
        let id;
        try {
          id = decodeURIComponent(window.location.hash.slice(1));
        } catch {
          id = "";
        }
        const target = id ? document.getElementById(id) : null;
        const selected =
          entries.find(
            ({ panel }) => panel === target || panel.contains(target),
          ) || entries[0];
        select(selected);
        // Old links to #history/#leadership/#documents/#contacts still reveal
        // their parent panel before the browser scrolls to the inner section.
        if (target)
          requestAnimationFrame(() =>
            target.scrollIntoView({ block: "start", behavior: "instant" }),
          );
      };
      entries.forEach((entry, index) => {
        entry.tab.addEventListener("click", (event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          select(entry, { historyMode: "push" });
        });
        entry.tab.addEventListener("keydown", (event) => {
          let next;
          const vertical =
            tablist.getAttribute("aria-orientation") === "vertical";
          if (
            event.key === "ArrowRight" ||
            (vertical && event.key === "ArrowDown")
          )
            next = (index + 1) % entries.length;
          else if (
            event.key === "ArrowLeft" ||
            (vertical && event.key === "ArrowUp")
          )
            next = (index - 1 + entries.length) % entries.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = entries.length - 1;
          else if (event.key === " ") next = index;
          else return;
          event.preventDefault();
          select(entries[next], { focus: true, historyMode: "replace" });
        });
      });
      window.addEventListener("hashchange", selectFromHash);
      selectFromHash();
    });
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
