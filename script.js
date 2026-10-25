const inputText = document.getElementById("inputText");
const runButton = document.getElementById("runButton");
const clearButton = document.getElementById("clearButton");
const message = document.getElementById("message");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
let latest = null;
let inputMode = "text";

function displayChar(ch) {
  if (ch === "\n") return "\\n";
  if (ch === "\r") return "\\r";
  if (ch === "\t") return "\\t";
  if (ch === " ") return "space";
  return ch;
}

function buildHuffman(text) {
  const frequencies = new Map();
  for (const ch of text) frequencies.set(ch, (frequencies.get(ch) || 0) + 1);

  let order = 0;
  let nodes = [...frequencies.entries()].map(([ch, freq]) => ({
    ch, freq, left: null, right: null, order: order++
  }));

  // Stable tie-breaking makes the demo's output predictable.
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq || a.order - b.order);
    const left = nodes.shift();
    const right = nodes.shift();
    nodes.push({
      ch: null,
      freq: left.freq + right.freq,
      left,
      right,
      order: order++
    });
  }

  const root = nodes[0];
  const codes = new Map();

  function walk(node, code) {
    if (!node.left && !node.right) {
      codes.set(node.ch, code || "0");
      return;
    }
    walk(node.left, code + "0");
    walk(node.right, code + "1");
  }
  walk(root, "");

  const encoded = Array.from(text, ch => codes.get(ch)).join("");
  const decoded = decodeBits(root, encoded);
  return { frequencies, root, codes, encoded, decoded };
}

function decodeBits(root, bits) {
  if (!root) return "";
  if (!root.left && !root.right) return root.ch.repeat(bits.length);

  let current = root;
  let result = "";
  for (const bit of bits) {
    current = bit === "0" ? current.left : current.right;
    if (!current) throw new Error("Invalid encoded sequence.");
    if (!current.left && !current.right) {
      result += current.ch;
      current = root;
    }
  }
  return result;
}

function renderCodes(data) {
  const body = document.getElementById("codesBody");
  body.replaceChildren();
  const entries = [...data.frequencies.entries()].sort((a, b) => a[0].codePointAt(0) - b[0].codePointAt(0));
  for (const [ch, freq] of entries) {
    const tr = document.createElement("tr");
    for (const value of [displayChar(ch), freq, data.codes.get(ch)]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}

function renderTree(root, targetId) {
  const target = document.getElementById(targetId);
  if (!root) {
    target.innerHTML = '<p class="muted">Run the algorithm to build the tree.</p>';
    return;
  }

  const nodes = [];
  const edges = [];
  let maxDepth = 0;
  function collect(node, depth, path) {
    node._depth = depth;
    node._path = path;
    nodes.push(node);
    maxDepth = Math.max(maxDepth, depth);
    if (node.left) {
      edges.push({ from: node, to: node.left, label: "0" });
      collect(node.left, depth + 1, path + "0");
    }
    if (node.right) {
      edges.push({ from: node, to: node.right, label: "1" });
      collect(node.right, depth + 1, path + "1");
    }
  }
  collect(root, 0, "");

  const leafNodes = nodes.filter(n => !n.left && !n.right);
  const leafSpacing = Math.max(72, Math.min(110, 650 / Math.max(leafNodes.length, 1)));
  const topPad = 35, levelGap = 78, radius = 23;
  const leafPositions = new Map();
  leafNodes.forEach((node, i) => leafPositions.set(node, 35 + (i + .5) * leafSpacing));

  function position(node) {
    if (!node.left && !node.right) {
      node._x = leafPositions.get(node);
    } else {
      position(node.left);
      position(node.right);
      node._x = (node.left._x + node.right._x) / 2;
    }
    node._y = topPad + node._depth * levelGap;
  }
  position(root);

  const width = Math.max(260, leafNodes.length * leafSpacing + 70);
  const height = topPad * 2 + maxDepth * levelGap + 30;
  const xShift = 35;
  const sx = x => x + xShift;
  const edgeSvg = edges.map(e => {
    const x1 = sx(e.from._x), y1 = e.from._y + radius * .7;
    const x2 = sx(e.to._x), y2 = e.to._y - radius * .7;
    const lx = (x1 + x2) / 2 + (e.label === "0" ? -9 : 9);
    const ly = (y1 + y2) / 2 - 3;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9b96bd" stroke-width="2"/><text x="${lx}" y="${ly}" class="edge-label">${e.label}</text>`;
  }).join("");

  const nodeSvg = nodes.map(n => {
    const leaf = !n.left && !n.right;
    const label = leaf ? displayChar(n.ch) : String(n.freq);
    const fill = leaf ? "#e2f8df" : "#ece9ff";
    const stroke = leaf ? "#69ad69" : "#7666d4";
    const x = sx(n._x), y = n._y;
    const second = leaf ? `(${n.freq})` : "";
    return `<g><circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/><text x="${x}" y="${second ? y - 3 : y + 4}" class="node-label">${escapeXml(label.length > 7 ? label.slice(0, 6) + "…" : label)}</text>${second ? `<text x="${x}" y="${y + 13}" class="node-sub">${second}</text>` : ""}</g>`;
  }).join("");

  target.innerHTML = `<svg viewBox="0 0 ${width + xShift * 2} ${height}" role="img" aria-label="Huffman binary tree"><style>.edge-label{font:700 13px Inter, sans-serif;fill:#4b4382}.node-label{font:700 12px Inter, sans-serif;fill:#28234c;text-anchor:middle}.node-sub{font:11px Inter,sans-serif;fill:#28234c;text-anchor:middle}</style>${edgeSvg}${nodeSvg}</svg>`;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[ch]));
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function runHuffman() {
  const text = inputText.value;
  if (!text.length) {
    message.textContent = "Please enter text or choose a non-empty text file.";
    message.className = "message error";
    return;
  }
  try {
    latest = buildHuffman(text);
    renderCodes(latest);
    renderTree(latest.root, "treeCanvas");
    renderTree(latest.root, "treeCanvasSmall");
    setText("encodedOutput", latest.encoded);
    setText("encodedOutputSmall", latest.encoded);
    setText("decodedOutput", latest.decoded);
    setText("decodedOutputSmall", latest.decoded);

    const originalBits = Array.from(text).length * 8;
    const encodedBits = latest.encoded.length;
    const saved = originalBits ? ((originalBits - encodedBits) / originalBits) * 100 : 0;
    setText("originalSize", `${originalBits.toLocaleString()} bits`);
    setText("encodedSize", `${encodedBits.toLocaleString()} bits`);
    setText("savedPercent", `${saved.toFixed(2)}%`);
    const status = document.getElementById("decodeStatus");
    if (latest.decoded === text) {
      status.className = "status-box success";
      status.textContent = "✓ Decoding is correct! The decoded text matches the input.";
    } else {
      status.className = "status-box error";
      status.textContent = "Decoding check failed. The output differs from the input.";
    }
    message.textContent = `Processed ${Array.from(text).length} characters and ${latest.frequencies.size} distinct character(s).`;
    message.className = "message";
  } catch (error) {
    message.textContent = `Could not process this text: ${error.message}`;
    message.className = "message error";
  }
}

function clearAll() {
  inputText.value = "";
  fileInput.value = "";
  fileName.textContent = "No file selected";
  latest = null;
  document.getElementById("codesBody").innerHTML = '<tr><td colspan="3" class="empty-cell">Your character codes will appear here.</td></tr>';
  renderTree(null, "treeCanvas");
  renderTree(null, "treeCanvasSmall");
  ["encodedOutput", "encodedOutputSmall", "decodedOutput", "decodedOutputSmall"].forEach(id => setText(id, "—"));
  ["originalSize", "encodedSize", "savedPercent"].forEach(id => setText(id, "—"));
  const status = document.getElementById("decodeStatus");
  status.className = "status-box neutral";
  status.textContent = "Run Huffman Coding to see whether decoding reproduces your input.";
  message.textContent = "";
}

document.getElementById("textTab").addEventListener("click", () => {
  inputMode = "text";
  document.getElementById("textTab").classList.add("active");
  document.getElementById("fileTab").classList.remove("active");
  document.getElementById("fileControls").classList.add("hidden");
  inputText.disabled = false;
});
document.getElementById("fileTab").addEventListener("click", () => {
  inputMode = "file";
  document.getElementById("fileTab").classList.add("active");
  document.getElementById("textTab").classList.remove("active");
  document.getElementById("fileControls").classList.remove("hidden");
  inputText.disabled = false;
  fileInput.click();
});
fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  fileName.textContent = file.name;
  inputText.value = await file.text();
  inputMode = "file";
  message.textContent = `Loaded ${file.name}. Click Run Huffman Coding to process it.`;
  message.className = "message";
});
runButton.addEventListener("click", runHuffman);
clearButton.addEventListener("click", clearAll);

document.querySelectorAll(".view-tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".view-tab").forEach(b => b.classList.toggle("active", b === button));
    const view = button.dataset.view;
    document.getElementById("codesView").classList.toggle("hidden", view !== "codes");
    document.getElementById("treeView").classList.toggle("hidden", view !== "tree");
    document.getElementById("outputView").classList.toggle("hidden", view !== "output");
  });
});

document.querySelectorAll(".copy-button").forEach(button => {
  button.addEventListener("click", async () => {
    const value = document.getElementById(button.dataset.copy).textContent;
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      const previous = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => button.textContent = previous, 1000);
    } catch {
      message.textContent = "Clipboard access was blocked by your browser. Select and copy the output manually.";
      message.className = "message error";
    }
  });
});

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
document.getElementById("downloadEncoded").addEventListener("click", () => {
  if (latest) downloadText("encoded.txt", latest.encoded);
});
document.getElementById("downloadDecoded").addEventListener("click", () => {
  if (latest) downloadText("decoded.txt", latest.decoded);
});

// Run the sample on initial load so the UI is immediately demonstrable.
runHuffman();