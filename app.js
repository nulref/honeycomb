let WORDS = null;
let currentResults = [];      // the current filtered word list (in display order)
let currentWordIndex = -1;    // which word is active in the modal

async function loadWordList() {
  if (WORDS) return WORDS;

  // wordlist.txt should be in the same folder as index.html / app.js
  const resp = await fetch("./wordlist.txt", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(
      `Could not load wordlist.txt (HTTP ${resp.status}). Put wordlist.txt next to index.html.`
    );
  }

  const text = await resp.text();

  // Normalize: trim, lowercase, remove empty lines
  WORDS = text
    .split(/\r?\n/)
    .map(w => w.trim())
    .filter(Boolean);

  return WORDS;
}

function normalizeLetters(str) {
  // Accept "r i t o a c" or "rit oac" etc.
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function validateInputs(outerRaw, centerRaw) {
  const outer = normalizeLetters(outerRaw);
  const center = normalizeLetters(centerRaw);

  if (center.length !== 1) {
    return { ok: false, message: "Center letter must be exactly 1 letter." };
  }
  if (outer.length !== 6) {
    return { ok: false, message: "Outer letters must be exactly 6 letters." };
  }

  const all = outer + center;
  const unique = new Set(all.split(""));
  if (unique.size !== 7) {
    return { ok: false, message: "All 7 letters must be unique (no duplicates)." };
  }

  return { ok: true, outer, center, allowedSet: unique };
}

function isAllowedWord(word, allowedSet, centerLetter) {
  // basic checks
  if (word.length < 4) return false;

  // Exclude proper nouns if the list contains case:
  // (If your list is all lowercase already, this is harmless.)
  if (word !== word.toLowerCase()) return false;

  // Must include center letter
  if (!word.includes(centerLetter)) return false;

  // Only allowed letters (repeats ok)
  for (const ch of word) {
    if (!allowedSet.has(ch)) return false;
  }

  return true;
}

const definitionCache = new Map();

function renderResults(words) {
  const ul = document.getElementById("results");
  const count = document.getElementById("count");
  currentResults = words.slice();   // keep the order the user sees
  currentWordIndex = -1;

  ul.innerHTML = "";
  count.textContent = `${words.length} word(s) found`;

  for (const w of words) {
    const li = document.createElement("li");

    // Milligram-friendly: a simple button
    const btn = document.createElement("button");
    btn.className = "button button-outline";
    btn.type = "button";
    btn.textContent = w;

    btn.addEventListener("click", () => showDefinition(w));

    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg || "";
}

function setError(msg) {
  document.getElementById("error").textContent = msg || "";
}

async function solve() {
  setError("");
  setStatus("Loading dictionary...");

  const outerRaw = document.getElementById("outer").value;
  const centerRaw = document.getElementById("center").value;

  const v = validateInputs(outerRaw, centerRaw);
  if (!v.ok) {
    setStatus("");
    setError(v.message);
    renderResults([]);
    return;
  }

  const { allowedSet, center } = v;

  let list;
  try {
    list = await loadWordList();
  } catch (e) {
    setStatus("");
    setError(e.message);
    renderResults([]);
    return;
  }

  setStatus("Filtering words...");

  const results = [];
  for (const w of list) {
    const word = w.trim();
    if (isAllowedWord(word, allowedSet, center)) {
      results.push(word);
    }
  }

  // Sort: longer first, then alphabetical
  results.sort((a, b) => b.length - a.length || a.localeCompare(b));

  setStatus("");
  renderResults(results);
}

function setDefinitionHtml(html) {
  document.getElementById("definitionBox").innerHTML = html;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function fetchDefinition(word) {
  // Cache first
  if (definitionCache.has(word)) return definitionCache.get(word);
  
  const cleaned = sanitizeForLookup(word);
  if (!cleaned) throw new Error("Invalid word for lookup.");

  if (definitionCache.has(cleaned)) return definitionCache.get(cleaned);
  
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    // API returns 404 for "No Definitions Found"
    throw new Error(`No definition found for "${word}".`);
  }

  const data = await resp.json();
  definitionCache.set(word, data);
  return data;
}

function sanitizeForLookup(word) {
  // Keep only letters a–z. Spelling Bee words are letters only anyway.
  return (word || "").toLowerCase().replace(/[^a-z]/g, "");
}

function formatDictionaryApiResponse(word, data) {
  // data is an array of entries
  // Each entry typically has: word, phonetics, meanings[{partOfSpeech, definitions[{definition, example, synonyms...}]}]
  const entry = data?.[0];
  if (!entry || !entry.meanings) {
    return `<p><strong>${escapeHtml(word)}</strong></p><p>No usable definition data returned.</p>`;
  }

  const phonetic = entry.phonetic ? ` <span style="color:#666">/${escapeHtml(entry.phonetic)}/</span>` : "";

  let html = `<p><strong>${escapeHtml(word)}</strong>${phonetic}</p>`;

  for (const meaning of entry.meanings) {
    html += `<p><strong>${escapeHtml(meaning.partOfSpeech || "")}</strong></p><ol>`;

    // Show top 3 definitions to keep it readable
    const defs = (meaning.definitions || []).slice(0, 3);
    for (const d of defs) {
      html += `<li>${escapeHtml(d.definition || "")}`;
      if (d.example) {
        html += `<br><em style="color:#666">Example: ${escapeHtml(d.example)}</em>`;
      }
      html += `</li>`;
    }
    html += `</ol>`;
  }

  return html;
}

async function showDefinition(word) {
  openModal(`Definition: ${word}`, `<p><em>Looking up “${escapeHtml(word)}”...</em></p>`);

  try {
    const data = await fetchDefinition(word);
    const html = formatDictionaryApiResponse(word, data);
    // Update modal body (keep it open)
    modalBodyEl.innerHTML = html;
  } catch (err) {
    modalBodyEl.innerHTML = `<p><strong>${escapeHtml(word)}</strong></p><p>${escapeHtml(err.message)}</p>`;
  }
}

const modalEl = document.getElementById("defModal");
const modalBodyEl = document.getElementById("defBody");
const modalTitleEl = document.getElementById("defTitle");
const modalCloseBtn = document.getElementById("defCloseBtn");

let lastFocusedEl = null;

function openModal(title, bodyHtml) {
  lastFocusedEl = document.activeElement;

  modalTitleEl.textContent = title;
  modalBodyEl.innerHTML = bodyHtml;

  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");

  // Focus close button for accessibility/keyboard users
  modalCloseBtn.focus();

  // Prevent background scroll (optional but nice)
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";

  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
    lastFocusedEl.focus();
  }
}

function openDefinitionAtIndex(index) {
  currentWordIndex = index;
  openModal(`Definition: ${currentResults[index]}`, `<p><em>Loading…</em></p>`);
  updateNavButtons();
  showDefinitionByIndex(index);
}


// Close when clicking the dark overlay (but not when clicking inside the dialog)
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});

modalCloseBtn.addEventListener("click", closeModal);

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalEl.classList.contains("is-open")) {
    closeModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (!modalEl.classList.contains("is-open")) return;

  if (e.key === "Escape") closeModal();
  if (e.key === "ArrowLeft") navigateDefinition(-1);
  if (e.key === "ArrowRight") navigateDefinition(1);
});


function updateNavButtons() {
  const hasWords = currentResults.length > 0 && currentWordIndex >= 0;
  prevBtn.disabled = !hasWords || currentWordIndex === 0;
  nextBtn.disabled = !hasWords || currentWordIndex === currentResults.length - 1;
}

function navigateDefinition(delta) {
  if (!currentResults.length) return;

  const nextIndex = currentWordIndex + delta;
  if (nextIndex < 0 || nextIndex >= currentResults.length) return;

  currentWordIndex = nextIndex;
  showDefinitionByIndex(currentWordIndex);
}

async function showDefinitionByIndex(index) {
  const word = currentResults[index];
  updateNavButtons();

  // Update title immediately for responsiveness
  modalTitleEl.textContent = `Definition: ${word}`;
  modalBodyEl.innerHTML = `<p><em>Looking up “${escapeHtml(word)}”...</em></p>`;

  try {
    const data = await fetchDefinition(word);
    modalBodyEl.innerHTML = formatDictionaryApiResponse(word, data);
  } catch (err) {
    modalBodyEl.innerHTML = `<p><strong>${escapeHtml(word)}</strong></p><p>${escapeHtml(err.message)}</p>`;
  }

  updateNavButtons();
}

const prevBtn = document.getElementById("prevWordBtn");
const nextBtn = document.getElementById("nextWordBtn");

prevBtn.addEventListener("click", () => navigateDefinition(-1));
nextBtn.addEventListener("click", () => navigateDefinition(1));

document.getElementById("solveBtn").addEventListener("click", solve);

// Optional: press Enter in either input
document.getElementById("outer").addEventListener("keydown", (e) => {
  if (e.key === "Enter") solve();
});
document.getElementById("center").addEventListener("keydown", (e) => {
  if (e.key === "Enter") solve();
});
